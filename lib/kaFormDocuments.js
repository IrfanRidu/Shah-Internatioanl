import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calculateIncentiveCosting, resolveEffectiveRateBDT } from './incentiveUtils';
import { hasBengaliChars, ensureBengaliFontLoaded, wrapBengaliText, measureTextWidthMm, drawBengaliText, measureBengaliBlockHeightMm } from './bengaliText';

// Batch 9 (R19-R24) — Ka Form + Stamp Application document generation. Mirrors lib/exportDocuments.js's
// own architecture (client-side generation, jsPDF/docx/xlsx, downloadBlob pattern, "assemble the data
// once, render 3 ways" split). R24: reworked against REAL reference PDFs for both languages of both
// documents (previously the Bengali Ka Form had no reference sample at all — one now exists) —
// rasterized and visually cross-checked pixel-by-pixel, not just text-extracted, since pdftotext
// garbles complex Bengali conjuncts/reordering on copy-out even when the source PDF itself is clean.
// See KA_FORM_AND_STAMP_REFERENCE.md for the original extraction and this file's own comments below
// for what changed in R24.

// ---------------------------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------------------------

const BN_DIGITS = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
export function toBengaliDigits(str) {
  return String(str ?? '').replace(/[0-9]/g, (d) => BN_DIGITS[d]);
}

// R24 — the digit convention is NOT "Bengali language -> Bengali digits everywhere"; it's per-field,
// confirmed by zooming into the real reference PDFs pixel-by-pixel (pdftotext's own extraction of
// these reorders/garbles complex Bengali conjuncts, so it can't be trusted for this level of detail):
//  - Ka Form (both languages' own reference PDF): serial/SL numbers, BDT/Taka amounts, and the bank's
//    exchange rate render in Bengali numerals when lang=bn. Foreign-currency amounts, dates,
//    quantities/KG, and reference codes (TT/EXP/AWB/contract/ERC numbers) stay Latin numerals even in
//    the Bengali form — these are figures a bank must match byte-for-byte against foreign documents.
//  - Stamp Application (bn reference): the opposite — genuinely everything (dates, EXP numbers,
//    amounts) is Bengali numerals; it's a narrative undertaking letter, not a bank reconciliation
//    form. That behavior was already correct here and is untouched.
// South Asian/lakh-style grouping (5,00,000.00, not 500,000.00) either way — confirmed from the
// reference Ka Form PDF itself, which uses this convention even in its English rendering.
function formatMoneyLakh(n) {
  const num = Number(n) || 0;
  const formatted = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(num));
  return (num < 0 ? '-' : '') + formatted;
}
// Foreign-currency amounts — ALWAYS Latin digits, regardless of document language (Ka Form rule).
function moneyFC(n) {
  return formatMoneyLakh(n);
}
// BDT/Taka amounts and the exchange rate — Bengali digits when lang=bn (Ka Form rule); also the
// general-purpose formatter the Stamp Application uses for its (always-Bengali-when-bn) amounts.
function formatMoney(n, lang) {
  const formatted = formatMoneyLakh(n);
  return lang === 'bn' ? toBengaliDigits(formatted) : formatted;
}
function formatDateRaw(d, sep) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return [String(dt.getDate()).padStart(2, '0'), String(dt.getMonth() + 1).padStart(2, '0'), dt.getFullYear()].join(sep);
}
// Ka Form's own date convention is dots (DD.MM.YYYY), always Latin digits (see rule above).
const formatDateDot = (d) => formatDateRaw(d, '.');
// Stamp Application's convention is slashes (DD/MM/YYYY), Bengali digits when lang=bn.
const formatDateSlash = (d, lang) => (lang === 'bn' ? toBengaliDigits(formatDateRaw(d, '/')) : formatDateRaw(d, '/'));
// Serial numbers (SL/ক্রম column) — Bengali digits when lang=bn, both documents.
function localizeNumber(n, lang) {
  return lang === 'bn' ? toBengaliDigits(String(n)) : String(n);
}
// Quantities (KG) and reference codes — always Latin, both documents (see rule above). Named
// separately from a plain String(n) call at each site purely so the "always Latin, on purpose" intent
// reads clearly at every call site rather than looking like a forgotten conversion.
function plainNumber(n) {
  return String(n);
}
// Bengali currency NAME (not code) — confirmed from the real reference: Ka Form Section C header
// reads "মূল্য (ইউরো)" not "Value (EUR)", and the Stamp Application spells the currency out in prose
// the same way. Falls back to the raw code for any currency not in this map rather than breaking.
const CCY_NAME_BN = { EUR: 'ইউরো', USD: 'ডলার', GBP: 'পাউন্ড', INR: 'রুপি', PKR: 'রুপি', BDT: 'টাকা', AED: 'দিরহাম', SAR: 'রিয়াল' };
function ccyLabel(code, lang) {
  return lang === 'bn' ? (CCY_NAME_BN[code] || code) : code;
}
// R34 — the Bengali reference PDF prefixes EVERY single foreign-currency figure in every table
// with its currency SYMBOL (e.g. "€ 4,542.00"), not the spelled-out name ccyLabel gives ("ইউরো")
// and not a bare number either - confirmed across Sections D/E/F/H, all six columns, all rows.
// The previous Bengali render was inconsistent: some cells were bare numbers, one spot glued the
// spelled-out Bengali currency word straight onto the figure with no space ("ইউরো5,098.00"). Kept
// local to this file (matching its existing self-contained-helpers style, e.g. ccyLabel/moneyFC
// above) rather than importing lib/utils.js's formatCurrency, which uses a different locale/
// grouping (en-US, not the lakh-style this whole document already commits to) and also glues the
// symbol on with no space.
const CCY_SYMBOL = { EUR: '€', USD: '$', GBP: '£', INR: '₹', PKR: '₨', BDT: '৳', AED: 'د.إ', SAR: '﷼' };
function ccySymbol(code) {
  return CCY_SYMBOL[code] || code;
}
// "Money with currency symbol" - the one function actually used for every figure inside Sections
// D/E/F/H's tables. `ccy` is the application's own foreign currency (EUR in the reference, but
// this stays whatever the shipment group's real baseCurrency is - never hardcoded).
function mc(n, ccy) {
  return `${ccySymbol(ccy)} ${moneyFC(n)}`;
}
// R34 — Section B's value line keeps the currency's full ENGLISH name in Latin letters even inside
// the otherwise-Bengali sentence ("...EURO 5,00,000.00", not the Bengali word "ইউরো") - confirmed
// from the reference; matches the same pattern Section C uses for "TT NO:"/"DT:" staying in Latin
// script mid-sentence. A small static lookup, not business data (same spirit as CCY_SYMBOL above).
const CCY_FULLNAME_EN = { EUR: 'EURO', USD: 'US DOLLAR', GBP: 'POUND STERLING', INR: 'INDIAN RUPEE', PKR: 'PAKISTANI RUPEE', AED: 'UAE DIRHAM', SAR: 'SAUDI RIYAL', BDT: 'TAKA' };
function ccyFullNameEn(code) {
  return CCY_FULLNAME_EN[code] || code;
}

// Triggers a browser download for an already-built Blob — identical pattern to
// lib/exportDocuments.js's own downloadBlob (kept as a separate local copy since these are two
// independent modules, same as that file keeps its own copy rather than a shared third file for
// one four-line helper).
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------------------------
// Editable boilerplate text (R21's "edit option... so admin can edit the hard coded texts")
// ---------------------------------------------------------------------------------------------

// R24: English keys are the real extracted text of the English reference PDF (unchanged from R21).
// Bengali keys are now ALSO from a real reference PDF (Form_KA_Bengali_Formatted.pdf, provided this
// round — previously there was none, and R21's Bengali text below was this file's own translation
// guess, flagged as such at the time). Transcribed by rasterizing that PDF and reading it visually
// rather than trusting pdftotext's raw extraction, which reorders/garbles complex Bengali conjuncts
// on this particular document even though the PDF itself renders correctly — see ROADMAP notes.
// A few structural differences from the English form, confirmed the same way (not just wording):
//  - The Bengali form's citation line sits just above Section H, not under the title like English —
//    see the lang==='bn' branch in generateKaFormPDF for the placement, not this data.
//  - The Bengali subtitle is ONE combined line, not two separate ones — subtitle2 is intentionally
//    empty for bn; renderers skip drawing a second line when it is.
//  - Section headings use "ঃ" (visarga) as their punctuation in Bengali, not a Latin colon.
export const DEFAULT_KA_FORM_TEXT = {
  en: {
    title: 'FORM "KA"',
    citation: '(Paragraph 3(Kha), FE Circular No. 15/2005)',
    subtitle1: 'APPLICATION FOR CASH INCENTIVE AGAINST EXPORT OF AGRICULTURAL PRODUCTS',
    subtitle2: '(BETEL LEAF, VEGETABLES AND FRUITS)',
    sectionA: 'NAME AND ADDRESS OF THE APPLICANT',
    sectionB: 'EXPORT L/C / CONTRACT NO., DATE & VALUE',
    sectionC: 'TT NO., DATE & VALUE',
    noteC: '(If the export value is repatriated from abroad by TT, the bank must satisfy itself, from the wording of the TT, that the amount received relates to the export against which the claim is being made, before accepting it.)',
    sectionD: 'SOURCE OF COLLECTION OF THE EXPORTED GOODS',
    noteD: 'Note: A certificate from the Export Promotion Bureau / concerned Association regarding the name, quantity, value and source of collection of the exported goods must be submitted.',
    sectionE: 'DETAILS OF THE EXPORT CONSIGNMENT',
    noteE: 'Note: Attested negotiable copies of the Export Invoice, Packing List and Bill of Lading / Airway Bill, etc., together with the Proceeds Realisation Certificate (PRC) for the export value, must be submitted.',
    sectionF: 'AMOUNT OF INCENTIVE APPLIED FOR',
    noteF: '(Where freight is applicable, a certified copy of the Freight Certificate mentioning the freight charge must be submitted.)',
    sectionG: 'DECLARATION',
    declaration: 'It is hereby declared that this application for incentive is made against the export of wholly indigenous agricultural products (vegetables and fruits). All information furnished in this application is completely correct. If it is subsequently found that there is any error, falsehood, deception or forgery in this declaration, the entire amount of incentive availed, or any part thereof, will be recovered from my/our bank account.',
    signatoryLine: "Signature and Designation of the Proprietor / Authorized Officer of the Applicant's Organization",
    sectionH: 'TO BE FILLED IN BY THE BANK BRANCH DISBURSING THE INCENTIVE',
    sectionHCaption: '',
    bankSignatoryLine: 'Signature, Name and Designation of the Authorized Bank Officer Approving the Incentive',
  },
  bn: {
    title: 'ফরম "ক"',
    // R34 (this round): corrected against a fresh, higher-quality rasterized reference (previous
    // "৩(খ)" was missing the leading zero the real form uses, and "দ্রষ্টব্য)" had drifted to "ইং)"
    // at some point after this was originally transcribed - re-verified pixel-by-pixel, not
    // re-guessed. Placement also fixed - see the lang==='bn' header block in generateKaFormPDF:
    // this now draws at the TOP next to the title, matching the real form. Earlier rounds had
    // concluded (from a different/lower-quality reference at the time) that Bengali's citation
    // sits just above Section H instead - that finding doesn't hold up against this reference.
    citation: '(অনুচ্ছেদ ০৩ (খ), এফই সার্কুলার নং-১৫/২০০৫ দ্রষ্টব্য)',
    subtitle1: 'কৃষিপণ্য (পান, শাক-সবজি ও ফলমূল) রপ্তানীর বিপরীতে ভর্তুকীর জন্য আবেদনপত্র।',
    subtitle2: '',
    sectionA: 'আবেদনকারীর নাম ও ঠিকানা',
    sectionB: 'রপ্তানী ঋণপত্র/চুক্তিপত্রের নম্বর ও তারিখ ও মূল্য',
    sectionC: 'টিটি নম্বর, তারিখ ও মূল্য',
    noteC: '(বিদেশ হইতে টিটির মাধ্যমে রপ্তানী মূল্য প্রত্যাবাসিত হইলে টিটির মাধ্যমে প্রাপ্তি সংশ্লিষ্ট রপ্তানীর বিপরীতে হইবার বিষয়টি টিটির ভাষ্য হইতে ব্যাংক কর্তৃক নিশ্চিত হইয়া লইতে হইবে।)',
    sectionD: 'রপ্তানীকৃত পণ্যের সংগ্রহ সূত্র',
    noteD: 'রপ্তানী পণ্যের নাম, পরিমাণ, মূল্য এবং সংগ্রহসূত্রের বিষয়ে রপ্তানী উন্নয়ন ব্যুরো / সংশ্লিষ্ট এসোসিয়েশন প্রদত্ত সনদপত্র দাখিল করিতে হইবে।',
    sectionE: 'রপ্তানী চালানের বিবরণ',
    noteE: 'রপ্তানী ইনভয়েস, প্যাকিং লিস্ট এবং বিল অব ল্যান্ডিং/এয়ারওয়ে বিল ইত্যাদি সত্যায়িত পাঠযোগ্য কপি এবং রপ্তানী মূল্য প্রত্যাবাসন সনদপত্র (পিআরসি) দাখিল করিতে হইবে।',
    sectionF: 'ভর্তুকীর আবেদনকৃত অংশ',
    noteF: '(প্রযোজ্য ক্ষেত্রে জাহাজ ভাড়ার উল্লেখ সম্বলিত ফ্রেইট সার্টিফিকেটের সত্যায়িত কপি দাখিল করিতে হইবে)',
    sectionG: 'ঘোষণা',
    declaration: 'ঘোষনা করা যাইতেছে যে, সম্পূর্ণ দেশীয় কৃষি পণ্য (শাক-সবজি, ফলমূল) রপ্তানীর বিপরীতে ভর্তুকীর আবেদন করা হইল। এই আবেদনপত্রে প্রদত্ত তথ্যাদি ঘোষণা সম্পূর্ণ সঠিক। পরবর্তীতে ইহাতে কোন ভুল/অসত্য/প্রতারণা/জালিয়াতি প্রমাণিত হইলে গৃহীত ভর্তুকীর সমুদয় অর্থ বা উহার অংশবিশেষ আমার/আমাদের ব্যাংক হিসাব হইতে আদায় করিয়া লওয়া হইবে।',
    signatoryLine: 'আবেদনকারীর প্রতিষ্ঠানের স্বত্বাধিকারী/ক্ষমতাপ্রাপ্ত কর্মকর্তার স্বাক্ষর ও পদবী',
    sectionH: 'ভর্তুকী প্রদানকারী ব্যাংক শাখা কর্তৃক পূরণীয়',
    // R34: this is now used as the 4th column's own table header (the real form has it INSIDE the
    // table, as that column's multi-line header text) rather than a standalone caption paragraph
    // drawn above the table - see the lang==='bn' Section H block in generateKaFormPDF. Wording
    // corrected against the reference too ("৩x১০%" the multiplier is column (৩) net FOB, not a
    // literal "10x"; "ওডি সাইট ক্রয়মূল্য" is the reference's own rate-type term, replacing the
    // previous "টিটি ক্রয়মূল্য হারে" wording - a label-only fix, not a change to which rate value
    // is actually used).
    sectionHCaption: 'পরিশোধযোগ্য ভর্তুকীর পরিমান (টাকায়: ৩x১০% রপ্তানী মূল্য প্রত্যাবাসন তারিখ ১০০ সংশ্লিষ্ট বৈদেশিক মুদ্রায় ওডি সাইট ক্রয়মূল্য)',
    bankSignatoryLine: 'ভর্তুকী অনুমোদনের ক্ষমতাপ্রাপ্ত ব্যাংক কর্মকর্তার স্বাক্ষর নাম ও পদবী',
  },
};

// Default-then-override, exactly matching lib/exportDocuments.js's resolveDocumentText contract.
export function resolveKaFormText(application, lang, key) {
  const override = application?.kaForm?.textOverrides?.[lang]?.[key];
  return override || DEFAULT_KA_FORM_TEXT[lang]?.[key] || DEFAULT_KA_FORM_TEXT.en[key] || '';
}

// R22 — full 5-paragraph/3-page text, both verbatim from the reference PDFs (English) and via a
// real clean pdftotext extraction (Bengali, an authentic embedded-font PDF, not a translation of
// my own) — see KA_FORM_AND_STAMP_REFERENCE.md. {TOKEN} placeholders substituted at assembly time.
export const DEFAULT_STAMP_TEXT = {
  en: `To,
The Deputy General Manager,
{BANK_NAME},
{BRANCH_NAME},
{BANK_ADDRESS}.

UNDERTAKING

I, {OWNER_NAME}, Proprietor, {LICENSE_NAME}, do hereby undertake that I have, for a long time, been conducting the business of exporting {CATEGORY_NAME} in the country and abroad under the name of the said firm. Against our export contract No. {CONTRACT_NO}, dated {CONTRACT_DATE}, we have exported agricultural products (betel leaf, {CATEGORY_NAME_LOWER}, and fruits) worth {CCY} {VALUE} against EXP Nos. {EXP_SEQUENCE}, through shipments dated {SHIPMENT_DATES}, and against the same, {CCY} {VALUE} has been repatriated to Bangladesh. All information submitted in this regard is true and accurate. The materials used in the exported goods have been purchased locally at cash value from the market.

{{PAGE_BREAK}}

We further undertake that all the information stated above is entirely true. All documents submitted to the Bank are correct. No fraudulent means whatsoever have been resorted to. If any document submitted is subsequently proven or found to be forged or false, appropriate action may be taken against me/us under the prevailing law.

Being fully aware of the above, and without inducement or influence from anyone, I/we, on this ______ day of ____________, have signed this Undertaking and/or affixed my/our own name and signature hereto.

                                                                                         Applicant

{{PAGE_BREAK}}

I/We undertake that I/we have applied within the stipulated time following the repatriation of my/our export proceeds, and that no export proceeds remain unrepatriated against the EXP forms submitted. Furthermore, within the past 2 (two) years or more from the date of the application submitted for the cash incentive, no other export bill of mine/ours remains unrepatriated, and no amount exceeding or falling short of 5% (five percent) of the invoice value has been repatriated. Furthermore, I/we have purchased the exported goods locally at cash value from the market.

If any information, declaration, export document, or matter relating to the calculation of the cash incentive furnished by me/us is subsequently proven or found to be incorrect, I/we shall bear full responsibility and liability for the same, and the Bank authority is hereby granted the right to adjust the objected amount from my/our account should any audit objection be raised. However, if the Bank authority is unable to adjust the objected amount owing to insufficiency of funds, I/we shall deposit the said amount with the Bank from my/our own sources, and no objection whatsoever shall be raised in this regard by me/us, or by any person or institution appointed or authorized by us, or by our heirs; and should any such objection be raised, it shall be disregarded in all courts.`,
  bn: `বরাবর,
ডেপুটি জেনারেল ম্যানেজার,
Sonali Bank,
Toyenbee Circular Road, Dhaka।

অঙ্গীকারনামা

{OWNER_NAME}, স্বত্বাধিকারী, {LICENSE_NAME} এই মর্মে অঙ্গীকার করিতেছি যে, আমি দীর্ঘ দিন যাবত সুনামের সহিত কোম্পানীর পক্ষে {CATEGORY_NAME} রপ্তানী ব্যবসা পরিচালনা করে আসতেছি। আমাদের রপ্তানী চুক্তিপত্র নং {CONTRACT_NO}, তারিখ:- {CONTRACT_DATE}ইং উক্ত চুক্তিপত্রের বিপরীতে আমরা {EXP_SEQUENCE} নম্বর ইএক্সপি এর অনুকূলে জাহাজীকরণের তারিখ:- {SHIPMENT_DATES} ইং এর মাধ্যমে {VALUE} {CCY} এর কৃষিপণ্য (পান, {CATEGORY_NAME} ও ফলমূল) রপ্তানী করিয়াছি এবং এর বিপরীতে {VALUE} {CCY} বাংলাদেশে প্রত্যাবাসিত হইয়াছে। এ বিষয়ে যে সব তথ্য পেশ করিয়াছি তা সত্য ও নির্ভুল। রপ্তানীকৃত পণ্যের ব্যবহৃত উপকরণ স্থানীয়ভাবে নগদ মূল্যে বাজার থেকে ক্রয় করিয়াছি।

{{PAGE_BREAK}}

এ ছাড়া ও আরো অঙ্গীকার করিতেছি যে, উপরে বর্ণিত সকল তথ্যাদি সম্পূর্ণ সত্য। ব্যাংকে সরবরাহকৃত সকল দলিলাদি সঠিক। কোন প্রকার জাল-জালিয়াতির আশ্রয় গ্রহন করা হয় নাই। দাখিলকৃত যেকোন দলিলাদি যদি ভবিষ্যতে জাল/অসত্য প্রমানিত হয় তবে দেশের প্রচলিত আইনে আমার/আমাদের বিরুদ্ধে যে কোন ব্যবস্থা গ্রহন করা যাইবে।

এতদ বিষয়ে সম্যক অবগত হইয়া এবং কাহারো বিনা প্ররোচনায় আমি/আমরা অদ্য.......... তারিখে নিজ নাম লিখিয়া/সহি অংকন করিয়া দিলাম।

                                                                                    নিবেদক

{{PAGE_BREAK}}

আমি/আমরা অঙ্গীকার করিতেছি যে, আমার/আমাদের রপ্তানীমূল্য প্রত্যাবাসিত হওয়ার পর নির্ধারিত সময়ের মধ্যেই আবেদন করিয়াছি এবং দাখিলকৃত ইএক্সপি সমূহের বিপরীতে কোন রপ্তানীমূল্য অপ্রত্যাবাসিত নাই। তাছাড়া নগদ সহায়তা প্রাপ্তির জন্য দাখিলকৃত উক্ত আবেদন পত্রের তারিখ হইতে বিগত ২ (দুই) বৎসর বা ততোধিক সময়ের মধ্যে আমার অন্য কোন রপ্তানী বিল অপ্রত্যাবাসিত নাই এবং ইনভয়েজ মূল্যের ৫ (পাঁচ)% এর বেশী অথবা কম মূল্য প্রত্যাবাসিত হয় নাই। তাছাড়া আমি/আমরা রপ্তানীকৃত পণ্য স্থানীয়ভাবে নগদমূল্যে বাজার থেকে ক্রয় করিয়াছি।

আমার/আমাদের প্রদত্ত কোন তথ্যাদি/ঘোষনা/রপ্তানী ডকুমেন্টস কিংবা নগদ সহায়তা হিসাবায়নে যদি পরবর্তীতে ভুল প্রমানিত/উদ্‌ঘাটিত হয় তাহা হইলে আমি/আমরা উক্ত কাজের সকল দায় দায়িত্ব বহন করিব এবং যে কোন ধরনের নিরীক্ষা আপত্তি উত্থাপিত হলে ব্যাংক কর্তৃপক্ষকে আমার/আমাদের হিসাব হইতে আপত্তি পরিমান অর্থ সমন্বয় করার অধিকার প্রদান করা হইলো। তবে তহবিল অপর্যাপ্ততার কারনে ব্যাংক কর্তৃপক্ষ আপত্তিকৃত অর্থ সমন্বয় করিতে ব্যর্থ হইলে আমি/আমরা উক্ত পরিমান অর্থ আমার/আমাদের নিজস্ব উৎস হইতে ব্যাংকে জমা প্রদান করিবো এবং এ বিষয়ে আমি/আমরা অথবা আমাদের কর্তৃক নিয়োজিত/ক্ষমতাপ্রাপ্ত কোন ব্যক্তি/প্রতিষ্ঠান অথবা আমাদের ওয়ারিশগন হইতে কোনরূপ ওজর আপত্তি উত্থাপন করা হইবেনা, যদি উত্থাপিত হয় তবে তাহা সর্ব আদালতে অগ্রাহ্য হইবে।`,
};

// R19's original sequence rule (first EXP got a -{year} suffix, middle ones bare, last got -{year}
// again) assumed expNo was entered as a bare sequential number with no year of its own — the
// declaration paragraph needed to annotate first/last to show the year range at all. That's no
// longer how expNo is entered (see expNoCell's comment above, batch 18 R32 / issue 2 R29): the admin now
// types the full value including its own year (e.g. "000367/2026"), so appending another "-year"
// on top — to ANY entry, not just first/last — would duplicate it exactly like the Section E bug
// did. Every EXP number in the sequence is now used exactly as entered, no special-casing needed.
function buildExpSequence(shipments, lang) {
  const parts = shipments.map((s) => {
    const text = s.expNo || '';
    return lang === 'bn' ? toBengaliDigits(text) : text;
  });
  return joinWithAnd(parts, lang);
}
function buildShipmentDatesSequence(shipments, lang) {
  return joinWithAnd(shipments.map((s) => formatDateSlash(s.date, lang)), lang);
}
function joinWithAnd(parts, lang) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const and = lang === 'bn' ? 'এবং' : 'and';
  return `${parts.slice(0, -1).join(', ')}, ${and} ${parts[parts.length - 1]}`;
}

// R34 — Section C (TT No., Date & Value) on the real Bengali reference form is NOT a bordered
// table at all (unlike English, which keeps its own existing side-by-side table treatment,
// untouched by this round) - it is one compact, bold, word-wrapped run of text directly after the
// section label, one "TT NO: x DT: y {symbol}z" segment per TT entry, pipe-separated, ending with
// "Total={sum}" as the last segment in the same run (confirmed by rasterizing the real reference
// PDF - see PROGRESS notes / KA_FORM_AND_STAMP_REFERENCE.md's own successor findings). Must
// support however many TT entries the member shipments actually carry (the reference sample shows
// 7, this app allows more) - built fresh from ttRows every time, nothing hardcoded.
// Kept as a fully separate builder from buildExpSequence/buildShipmentDatesSequence above even
// though the shape rhymes (join-many-parts-into-one-string) - those two feed the Stamp
// Application's prose (comma+"and"-joined, no symbols), this feeds a structurally different
// pipe-joined ledger-style line with a trailing computed total, sharing no formatting rules with them.
function buildTTInlineText(ttRows, ttTotal, ccy) {
  const symbol = ccySymbol(ccy);
  const parts = ttRows.map(([ttNumber, dateStr, valueStr]) => `TT NO: ${ttNumber} DT: ${dateStr} ${symbol} ${valueStr}`);
  parts.push(`Total=${moneyFC(ttTotal)}`);
  return parts.join('|');
}

// R34 — Section D's supplier field defaults, in the DATABASE schema itself (models/
// IncentiveApplication.js), to the English string below - so the existing lang-aware `||`
// fallback that already lived at this call site never actually fired in practice (the field is
// never falsy once Mongoose applies its own default at creation time), which is why the Bengali
// PDF was showing English text here. Not a schema change (out of scope for a PDF-template fix,
// and would affect every other consumer of this field) - instead: if the stored value is empty OR
// is literally still that untouched English default, substitute the real Bengali default the
// reference form uses. Any genuine admin-typed override (a real supplier name/address) is dynamic
// business data and passes through completely untouched, in either language.
const SUPPLIER_DEFAULT_EN = 'Self-collected / own arrangement';
const SUPPLIER_DEFAULT_BN = 'রপ্তানী পণ্য নিজস্ব উদ্যোগে সংগৃহীত:';
function resolveSupplierLabel(application, lang) {
  const stored = (application.kaForm?.supplierNameAddress || '').trim();
  if (lang === 'bn' && (!stored || stored === SUPPLIER_DEFAULT_EN)) return SUPPLIER_DEFAULT_BN;
  return stored || SUPPLIER_DEFAULT_EN;
}

// Assembles the Stamp Application's full text fresh from current data — always used unless the
// admin has explicitly saved an override (see resolveStampApplicationText), so it never goes stale
// as shipments/rates change underneath it.
export function assembleStampApplicationText({ application, shipments, license, contract, bank, lang }) {
  const template = DEFAULT_STAMP_TEXT[lang] || DEFAULT_STAMP_TEXT.en;
  const category = application?.exportCategory;
  const costing = calculateIncentiveCosting({
    shipments, category,
    effectiveRateBDT: shipments.length ? resolveEffectiveRateBDT(shipments[0], application) : 0,
    commissionInsuranceValue: application?.kaForm?.commissionInsuranceValue,
  });
  const categoryName = category?.name || '';
  const tokens = {
    BANK_NAME: bank?.beneficiaryBank || bank?.bankName || '',
    BRANCH_NAME: bank?.branchName || '',
    BANK_ADDRESS: bank?.bankAddress || '',
    OWNER_NAME: license?.ownerName || '',
    LICENSE_NAME: license?.licenseName || '',
    CATEGORY_NAME: categoryName,
    CATEGORY_NAME_LOWER: categoryName.toLowerCase(),
    CONTRACT_NO: contract?.contractNo || '',
    CONTRACT_DATE: formatDateSlash(contract?.date, lang),
    // The real Bengali reference spells the currency out as a word ("ইউরো"), not the ISO code — see
    // ccyLabel's own comment. English keeps the ISO code as before.
    CCY: ccyLabel(application?.referenceCurrency || '', lang),
    VALUE: formatMoney(costing.totalRepatriatedFC, lang),
    EXP_SEQUENCE: buildExpSequence(shipments, lang),
    SHIPMENT_DATES: buildShipmentDatesSequence(shipments, lang),
  };
  return Object.entries(tokens).reduce((text, [key, val]) => text.split(`{${key}}`).join(val), template);
}

// Override-wins-verbatim-once-set, same contract as R5's existing document-text-override feature.
export function resolveStampApplicationText(args) {
  const override = args.application?.others?.stampApplication?.textOverride?.[args.lang];
  return override || assembleStampApplicationText(args);
}

// ---------------------------------------------------------------------------------------------
// Shared data assembly for the Ka Form (Sections A-H) — one source feeding PDF/DOCX/XLSX alike,
// same "assemble once, render 3 ways" discipline lib/exportDocuments.js's assembleDocData already
// established for the other document family in this app.
// ---------------------------------------------------------------------------------------------
function assembleKaFormData(application, lang) {
  const shipments = application.shipments || [];
  const license = application.exportLicense || {};
  const contract = application.exportContract || {};
  const category = application.exportCategory || {};
  const ccy = application.referenceCurrency || 'EUR';
  const effectiveRateBDT = shipments.length ? resolveEffectiveRateBDT(shipments[0], application) : 0;
  const costing = calculateIncentiveCosting({
    shipments, category, effectiveRateBDT,
    commissionInsuranceValue: application.kaForm?.commissionInsuranceValue,
  });
  const totalGrossWeightKg = shipments.reduce((sum, s) => sum + (Number(s.totalGrossWeightKg) || 0), 0);
  const t = (key) => resolveKaFormText(application, lang, key);
  // Foreign-currency values -> always Latin digits (moneyFC); BDT/rate values -> Bengali digits when
  // lang=bn (MBDT). Dates -> always Latin (DDot). SL/serial numbers -> Bengali digits when lang=bn
  // (localizeNumber, used inline at each SL call site). See the digit-convention comment up top.
  const M = (n) => moneyFC(n);
  const MBDT = (n) => formatMoney(n, lang);
  const DDot = (d) => formatDateDot(d);

  const ttRows = shipments.flatMap((s) => (s.ttEntries || []).map((tt) => [tt.ttNumber, DDot(tt.ttDate), M(tt.ttValue)]));
  const ttTotal = shipments.reduce((sum, s) => sum + (s.ttEntries || []).reduce((a, tt) => a + (Number(tt.ttValue) || 0), 0), 0);

  const goodsName = application.kaForm?.goodsNameOverride || category.name || '';
  const goodsQty = application.kaForm?.goodsQuantityOverrideKg ?? totalGrossWeightKg;

  const latestTT = (entries) => (entries || []).reduce((latest, tt) => (!latest || new Date(tt.ttDate) > new Date(latest.ttDate) ? tt : latest), null);
  // Batch 18 (R32): the EXP No. & Date column shows the EXP No. ALONE, never a separately-appended
  // date — this was actually already established by the reference research itself
  // (KA_FORM_AND_STAMP_REFERENCE.md, Section E: "rendered as {expNo}/{year}, no separate date
  // sub-field despite the header's '& Date' — confirmed from every sample row"), but R29 (issue 2)
  // deviated from that finding, assuming the header's "& Date" wording meant a real date value was
  // missing and appending one (the shipment's expDate/date) on top of the admin-entered EXP No.,
  // which already carries its own year (e.g. "000367/2026" — the "date" the header alludes to).
  // That produced exactly the duplicated-looking "000367/2026" + a full date on the next line that
  // was reported as wrong. The column HEADER text itself ("EXP No. & Date") is left unchanged
  // here — it's the government form's own official wording, confirmed from real samples, not
  // something this app invented — only the previously-appended date VALUE is removed.
  const expNoCell = (s) => s.expNo || '';
  // Both languages: 7 columns (SL, Description, Quantity, Invoice Value, Ship Date, EXP Number,
  // Repatriated Value & Date) — EXP No.&Date and Repatriated Value&Date are separate columns in
  // BOTH. A previous round's Bengali path stacked those last two into one merged cell under a
  // single header, on a "confirmed visually... narrower A4 page, no room for a 7th column" note —
  // a fresh reference PDF this round (rasterized and inspected column-by-column, not re-guessed)
  // shows the Bengali original has these as two genuinely separate columns too, same as English;
  // that earlier assumption didn't hold up. sectionERowsBn (a near-duplicate that only differed by
  // this now-corrected merge) has been removed — both languages share sectionERows below, since
  // lang-sensitive formatting (Bengali digits, etc.) is already threaded through M/DDot/
  // localizeNumber inside it, not something that needed a second copy of the row-mapping itself.
  const sectionERows = shipments.map((s, i) => {
    const invoiceValueFC = (Number(s.orderValueForeign) || 0) + (Number(s.freightCost) || 0);
    const tt = latestTT(s.ttEntries);
    return [
      localizeNumber(i + 1, lang), category.name || '', `${plainNumber(s.totalGrossWeightKg || 0)} KG`,
      M(invoiceValueFC), DDot(s.date), expNoCell(s),
      `${M(invoiceValueFC)} / ${tt ? DDot(tt.ttDate) : ''}`,
    ];
  });

  // Real 6-column Section F (Airway Bill + 5 numbered figure columns), each shipment's own row —
  // confirmed against both reference PDFs; previously only 3 columns existed with the other 3
  // figures squeezed into a merged footer text line, a real structural mismatch (see PDF renderer's
  // own comment for the full reasoning). Commission/insurance isn't tracked per-shipment in this data
  // model (only one admin-editable figure per application), so each row shows the same label the
  // reference itself shows per-row ("N/A" by default) and each row's own Net FOB/Incentive is
  // computed WITHOUT a per-row commission deduction — exactly matching calculateIncentiveCosting's
  // own per-shipment math (lib/incentiveUtils.js), which only applies commissionInsuranceFC once, at
  // the aggregate level, never per shipment.
  const incentivePct = Number(category.incentivePercentage) || 0;
  const commissionLabel = application.kaForm?.commissionInsuranceLabel || 'N/A';
  const sectionFFullRows = shipments.map((s) => {
    const repat = (Number(s.orderValueForeign) || 0) + (Number(s.freightCost) || 0);
    const freight = Number(s.freightCost) || 0;
    const netFobRow = repat - freight;
    const incentiveRow = netFobRow * (incentivePct / 100);
    return [s.awbNo || '', M(repat), M(freight), commissionLabel, M(netFobRow), M(incentiveRow)];
  });

  return {
    t, M, MBDT, DDot, ccy, shipments, license, contract, category, effectiveRateBDT, costing,
    totalGrossWeightKg, ttRows, ttTotal, goodsName, goodsQty, sectionERows,
    sectionFFullRows, incentivePct, commissionLabel,
    applicantLine: license.licenseName ? `${license.licenseName}, ${license.address || ''}` : '',
    contractLine: contract.contractNo ? `${contract.contractNo}, ${lang === 'bn' ? '' : 'dated '}${DDot(contract.date)}, ${ccy} ${M(contract.value)}` : '',
  };
}

// ---------------------------------------------------------------------------------------------
// PDF — R25 (issue 1): Ka Form is ALWAYS plain A3 for both languages, never the letterhead.
// R34 (this round): Bengali is A3 PORTRAIT (see pageGeometry() below). This round's first
// delivery had moved Bengali to A3 landscape, per that round's own spec document, which
// contradicted itself on orientation (one section said "portrait," another gave explicit
// landscape dimensions) — landscape was chosen at the time as the more specific, dimensioned
// instruction. The user has since confirmed landscape was a mistake on their part and portrait is
// what's actually wanted. Portrait also happens to match this app's own pre-existing Bengali page
// size (R25 onward) and the real reference PDF's own proportions — the reference is A4 portrait,
// and A3 portrait is the exact same shape, just 41% bigger in both directions (A3's area is double
// A4's). English is, and remains, A3 portrait throughout — completely unaffected by this change
// either way, since it was never touched by the landscape detour to begin with.
// ---------------------------------------------------------------------------------------------
const MARGIN = 14;
function pageGeometry() {
  const PAGE_W = 297, PAGE_H = 420;
  return { PAGE_W, PAGE_H, CONTENT_W: PAGE_W - MARGIN * 2 };
}
const TABLE_STYLE = {
  theme: 'grid',
  // R35: the gray (232,232,232) head/foot fill removed. It had been "sampled from the reference
  // PDF's own header-row fill" per an earlier round, but that finding doesn't hold up against the
  // actual official Bengali original (rasterized and inspected directly for the R34 Bengali round,
  // and reconfirmed here) or against this round's own explicit instruction to use plain black-
  // border-on-white throughout ("Do NOT use... gray UI headers... colored backgrounds") - matches
  // the same fix already made to bnDrawGridTable (Bengali's own hand-rolled table renderer) in R34.
  // Head/foot font also drops 8->7pt (still within this round's own suggested 7-9pt range for
  // table headers) - Section E/F/H's headers are long ("Repatriated Export Value (In Foreign
  // Currency) & Date of Repatriation", "Payable Incentive Amount (in Taka: 3x10/100...)...") and
  // wrap to several lines at 7 columns' worth of A3-portrait width; this measurably helps 7
  // shipments fit with real margin to spare rather than right at the edge. Body stays 8pt (matches
  // the suggested 8-9pt range for table values).
  headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2, fontSize: 7, halign: 'center' },
  bodyStyles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.15, fontSize: 8, halign: 'center' },
  footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2, fontSize: 7, halign: 'center' },
  styles: { cellPadding: 1.4, font: 'helvetica', halign: 'center' },
  margin: { left: MARGIN, right: MARGIN },
};

function sectionHeading(doc, y, text) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0);
  doc.text(text, MARGIN, y);
  return y + 5;
}
function noteText(doc, y, text, contentW) {
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(80, 80, 80);
  const lines = doc.splitTextToSize(text, contentW);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 3.2 + 3;
}
// Bengali section headings use "ঃ" (visarga), not a Latin colon, and the real Bengali section
// letters (ক,খ,গ,ঘ,ঙ,চ,ছ,জ) rather than transliterated A-H — confirmed visually against the reference.
const BN_SECTION_LETTERS = { A: 'ক', B: 'খ', C: 'গ', D: 'ঘ', E: 'ঙ', F: 'চ', G: 'ছ', H: 'জ' };
function sectionHeadingBn(doc, y, letter, text, contentW) {
  // No space before "ঃ" (was "${text} ঃ") — every section heading in the reference has the
  // visarga sitting flush against the last letter (e.g. "...সংগ্রহ সূত্রঃ", not "...সূত্র ঃ").
  // Size 9.5pt: this had briefly dropped to 9pt during a same-round landscape detour to fit that
  // orientation's tighter 297mm-tall canvas; back on portrait's 420mm there's no need to hold it
  // down that far, so it's back close to its original size.
  return drawBengaliText(doc, `(${BN_SECTION_LETTERS[letter] || letter}) ${text}ঃ`, MARGIN, y, { sizePt: 9.5, bold: true, maxWidthMm: contentW, align: 'left' }) + 3;
}
// R34 — Sections A and B keep heading+value on ONE line in the real reference (unlike C-H, which
// are heading-on-its-own-line then a block/table below - sectionHeadingBn above is for those).
// Draws "(letter) heading ঃ" then the value starting right after it on the same line, wrapping
// within whatever width remains if the value is long. Returns the Y position after the taller of
// the two (they're almost always the same single line in practice, but this is defensive in case a
// very long applicant address wraps).
function inlineHeadingValueBn(doc, y, headingText, value, contentW, opts = {}) {
  const headSize = 9.5;
  const valueSize = opts.valueSize || 9.5;
  const headW = measureTextWidthMm(headingText, headSize, false) + 2;
  const headEndY = drawBengaliText(doc, headingText, MARGIN, y, { sizePt: headSize, bold: true, maxWidthMm: headW + 3, align: 'left' });
  const valueEndY = drawBengaliText(doc, value || '—', MARGIN + headW, y, { sizePt: valueSize, bold: !!opts.valueBold, maxWidthMm: Math.max(contentW - headW, 30), align: 'left' });
  return Math.max(headEndY, valueEndY);
}
function noteTextBn(doc, y, text, contentW) {
  return drawBengaliText(doc, text, MARGIN, y, { sizePt: 7.3, italic: true, color: [80, 80, 80], maxWidthMm: contentW, align: 'left', lineGapMm: 0.6 }) + 2;
}

// ---- Bengali-only hand-rolled bordered grid table -----------------------------------------
// autoTable is NOT used for Bengali tables: its column-width/row-height algorithm measures text
// using jsPDF's loaded (Latin-only) font, which has no way to account for a cell whose real content
// is actually an embedded canvas image. Computing widths/heights ourselves keeps this fully
// deterministic instead of fighting autotable's internals for a case it wasn't designed for. English
// tables are completely unaffected — they still use autoTable exactly as before.
const MM_PER_PT = 25.4 / 72;
function bnCellLines(doc, cellRaw, sizePt, innerW) {
  return String(cellRaw ?? '').split('\n').map((lineText) => {
    if (hasBengaliChars(lineText)) {
      return { text: lineText, heightMm: measureBengaliBlockHeightMm(lineText, sizePt, innerW), bn: true };
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(sizePt);
    const plainLines = doc.splitTextToSize(lineText || ' ', innerW);
    return { text: lineText, plainLines, heightMm: plainLines.length * sizePt * MM_PER_PT * 1.28, bn: false };
  });
}
// R34 — dropped the gray (232,232,232) head/foot fill entirely. That shading was sampled from a
// different reference at the time; this round's real reference PDF (rasterized and inspected
// directly, every table, all 8 sections) has NO shaded cells anywhere — plain white background,
// black borders only, exactly the "official government/bank form" look this round's spec asks
// for. Also: the reference's body rows read as bold almost everywhere (headers, data, totals
// alike — consistent with a form that was originally typed with bold as the whole document's
// default weight), so body rows now default to bold too (`bodyBold`, true unless a caller opts
// out) rather than the previous hardcoded non-bold body.
function bnDrawGridTable(doc, { x, y, colWidthsMm, head = [], body = [], foot = [], aligns, fontSizePt = 8, cellPaddingMm = 1.0, bodyBold = true }) {
  const colAligns = aligns || colWidthsMm.map(() => 'center');
  let cursorY = y;
  const drawRow = (row, bold) => {
    const innerWidths = colWidthsMm.map((w) => w - cellPaddingMm * 2);
    const cellLineSets = row.map((cellRaw, ci) => bnCellLines(doc, cellRaw, fontSizePt, innerWidths[ci]));
    const rowH = Math.max(fontSizePt * MM_PER_PT * 1.28 + cellPaddingMm * 2, ...cellLineSets.map((lines) => lines.reduce((s, l) => s + l.heightMm, 0) + cellPaddingMm * 2));
    let cx = x;
    row.forEach((cellRaw, ci) => {
      const w = colWidthsMm[ci];
      doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.15);
      doc.rect(cx, cursorY, w, rowH);
      const align = colAligns[ci] || 'center';
      const lines = cellLineSets[ci];
      const blockH = lines.reduce((s, l) => s + l.heightMm, 0);
      let ly = cursorY + (rowH - blockH) / 2;
      lines.forEach((entry) => {
        if (entry.bn) {
          drawBengaliText(doc, entry.text, cx + cellPaddingMm, ly, { sizePt: fontSizePt, bold, maxWidthMm: innerWidths[ci], align });
        } else {
          doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(fontSizePt); doc.setTextColor(0, 0, 0);
          const tx = align === 'center' ? cx + w / 2 : align === 'right' ? cx + w - cellPaddingMm : cx + cellPaddingMm;
          doc.text(entry.plainLines, tx, ly + fontSizePt * MM_PER_PT * 0.92, { align });
        }
        ly += entry.heightMm;
      });
      cx += w;
    });
    cursorY += rowH;
  };
  head.forEach((row) => drawRow(row, true));
  body.forEach((row) => drawRow(row, bodyBold));
  foot.forEach((row) => drawRow(row, true));
  return cursorY;
}

export async function generateKaFormPDF(application, lang = 'en') {
  if (lang === 'bn') await ensureBengaliFontLoaded();
  const d = assembleKaFormData(application, lang);
  const { PAGE_W, PAGE_H, CONTENT_W } = pageGeometry();
  const doc = new jsPDF({ unit: 'mm', format: 'a3', orientation: 'portrait' });
  let y = MARGIN;
  // Safety net, not the common case: A3 with no letterhead reserve has substantial headroom for the
  // 1-7 shipment range this app allows per application, and the Bengali table density below was
  // tuned to fit comfortably within that — but this still guards against any pathological edge case
  // rather than silently drawing content past the bottom of the page.
  const ensureSpace = (curY, neededMm) => {
    if (curY + neededMm > PAGE_H - MARGIN) {
      doc.addPage();
      return MARGIN;
    }
    return curY;
  };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(0, 0, 0);
  if (lang === 'bn') {
    // R34: the real reference has NO separate big centered title. The citation (left) and the
    // "ফরম "ক"" title (right) share ONE line; the subtitle is its own centered line below that;
    // then a full-width rule — confirmed by rasterizing the actual reference page start-to-finish.
    // This also moves the citation here FROM just-above-Section-H (see Section H below) — that
    // placement was this codebase's own earlier finding, reached from a different/lower-quality
    // reference at the time; this round's reference is unambiguous about top placement and a
    // higher-resolution rasterization, so R34 defers to it over the earlier note.
    const titleSize = 13;
    const titleW = measureTextWidthMm(d.t('title'), titleSize, false);
    const headerLineY = y;
    const citationEndY = drawBengaliText(doc, d.t('citation'), MARGIN, headerLineY, { sizePt: 9, maxWidthMm: CONTENT_W * 0.62, align: 'left' });
    const titleEndY = drawBengaliText(doc, d.t('title'), PAGE_W - MARGIN - titleW, headerLineY, { sizePt: titleSize, bold: true, maxWidthMm: titleW + 2, align: 'left' });
    y = Math.max(citationEndY, titleEndY) + 1.5;
    y = drawBengaliText(doc, d.t('subtitle1'), MARGIN, y, { sizePt: 10.5, bold: true, maxWidthMm: CONTENT_W, align: 'center' }) + 2.5;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.35);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4;
  } else {
    doc.text(d.t('title'), PAGE_W / 2, y, { align: 'center' }); y += 5.5;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
    doc.text(d.t('citation'), PAGE_W / 2, y, { align: 'center' }); y += 6.5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(0, 0, 0);
    doc.text(d.t('subtitle1'), PAGE_W / 2, y, { align: 'center' }); y += 5;
    doc.text(d.t('subtitle2'), PAGE_W / 2, y, { align: 'center' }); y += 8;
  }

  // Section A
  const ercLine = `Export Registration Certificate (ERC) No.: ${d.license.ercNumber || ''}`;
  if (lang === 'bn') {
    // R34: heading+value stay INLINE on one line in the reference (both the name/address line and
    // the ERC line) — unlike Sections D-H, which are heading-on-its-own-line then a block below.
    // Sections A/B are the only two with this inline pattern, hence the dedicated helper rather
    // than sectionHeadingBn (which always forces a line break right after the heading). Name and
    // address are space-joined (no comma) matching the reference exactly; ERC label drops the old
    // "(ERC)" abbreviation the reference doesn't use.
    const nameAddr = d.license.licenseName ? `${d.license.licenseName} ${d.license.address || ''}`.trim() : '—';
    y = inlineHeadingValueBn(doc, y, `(${BN_SECTION_LETTERS.A}) ${d.t('sectionA')}ঃ`, nameAddr, CONTENT_W, { valueBold: true }) + 1.3;
    y = inlineHeadingValueBn(doc, y, 'রপ্তানী নিবন্ধন সনদপত্র নম্বরঃ', d.license.ercNumber || '', CONTENT_W) + 2.2;
  } else {
    y = sectionHeading(doc, y, `(A) ${d.t('sectionA')}:`);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(d.applicantLine || '—', MARGIN, y); y += 4.5;
    doc.text(ercLine, MARGIN, y); y += 7;
  }

  // Section B
  if (lang === 'bn') {
    // R34: also inline (see Section A above). Reference format is space-separated with a "DT:"
    // prefix on the date (slash-formatted, not dot) and the currency's full English name spelled
    // out ("EURO", not the ISO code "EUR" or the Bengali word) — rebuilt directly from d.contract
    // here rather than reusing the shared d.contractLine string (which stays comma-separated/
    // dot-dated/ISO-coded for English, DOCX and XLSX - all untouched by this round).
    const c = d.contract;
    const contractLineBn = c.contractNo
      ? `${c.contractNo}     DT: ${formatDateRaw(c.date, '/')}     ${ccyFullNameEn(d.ccy)} ${moneyFC(c.value)}`
      : '—';
    y = inlineHeadingValueBn(doc, y, `(${BN_SECTION_LETTERS.B}) ${d.t('sectionB')}ঃ`, contractLineBn, CONTENT_W, { valueBold: true }) + 2.8;
  } else {
    y = sectionHeading(doc, y, `(B) ${d.t('sectionB')}:`);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(d.contractLine || '—', MARGIN, y); y += 8;
  }

  // Section C — TT list. English splits into two side-by-side 5-row-capped tables once there are
  // more than 5 rows (confirmed visually: left column is always exactly 5 rows, remainder + TOTAL
  // go right) — UNCHANGED, this round's reference material is Bengali-only.
  y = ensureSpace(y, 20 + Math.min(d.ttRows.length, 6) * 6);
  if (lang === 'bn') {
    // R34: NOT a bordered table in the real reference — a single compact bold word-wrapped run of
    // text starting right at the heading's colon with no line break (the reference literally has
    // "...মূল্য:TT NO: ..." touching), one "TT NO: x DT: y {symbol} z" segment per TT entry,
    // pipe-separated, ending with "Total={sum}" in that same run. Supports however many TT entries
    // the member shipments actually carry (reference sample shows 7; buildTTInlineText handles any
    // count). Replaces the previous bordered ক্রম/টিটি নম্বর/তারিখ/মূল্য(ইউরো) table + its own
    // separately-shaded header/total rows entirely — this section has no table at all now.
    const headingText = `(${BN_SECTION_LETTERS.C}) ${d.t('sectionC')}ঃ`;
    const ttText = buildTTInlineText(d.ttRows, d.ttTotal, d.ccy);
    y = drawBengaliText(doc, `${headingText}${ttText}`, MARGIN, y, { sizePt: 8.5, bold: true, maxWidthMm: CONTENT_W, align: 'left', lineGapMm: 0.7 }) + 1.6;
    y = noteTextBn(doc, y, d.t('noteC'), CONTENT_W);
  } else {
    y = sectionHeading(doc, y, `(C) ${d.t('sectionC')}:`);
    const head = [['SL', 'TT No.', 'Date', `Value (${d.ccy})`]];
    if (d.ttRows.length > 5) {
      const left = d.ttRows.slice(0, 5).map((r, i) => [localizeNumber(i + 1, lang), ...r]);
      const right = d.ttRows.slice(5).map((r, i) => [localizeNumber(i + 6, lang), ...r]);
      const halfW = (CONTENT_W - 4) / 2;
      autoTable(doc, { startY: y, head, body: left, tableWidth: halfW, margin: { left: MARGIN, right: PAGE_W - MARGIN - halfW }, ...TABLE_STYLE });
      const leftFinalY = doc.lastAutoTable.finalY;
      autoTable(doc, { startY: y, head, body: right, foot: [['', '', 'TOTAL', d.M(d.ttTotal)]], tableWidth: halfW, margin: { left: MARGIN + halfW + 4, right: MARGIN }, ...TABLE_STYLE });
      y = Math.max(leftFinalY, doc.lastAutoTable.finalY) + 2;
    } else {
      autoTable(doc, { startY: y, head, body: d.ttRows.map((r, i) => [localizeNumber(i + 1, lang), ...r]), foot: [['', '', 'TOTAL', d.M(d.ttTotal)]], ...TABLE_STYLE });
      y = doc.lastAutoTable.finalY + 2;
    }
    y = noteText(doc, y, d.t('noteC'), CONTENT_W);
  }

  // Section D
  y = ensureSpace(y, 30);
  if (lang === 'bn') {
    // R34: supplierLabel's Bengali default is now resolved via resolveSupplierLabel (see its own
    // comment above the function) — the schema-level English default meant the previous inline
    // `||` fallback here never actually fired for lang='bn' in practice (the field is never falsy
    // once Mongoose applies its own default at creation time), which is why the Bengali PDF was
    // showing English text. Also added the numbering row (১|২|৩) the reference has beneath the
    // header (previously missing entirely) and switched the value cell to the €-symbol convention
    // (mc()) instead of the previous glued "ইউরো5,098.00" word+number with no space.
    const supplierLabelBn = resolveSupplierLabel(application, lang);
    y = sectionHeadingBn(doc, y, 'D', d.t('sectionD'), CONTENT_W);
    const colW = [CONTENT_W * 0.34, CONTENT_W * 0.33, CONTENT_W * 0.33];
    y = bnDrawGridTable(doc, {
      x: MARGIN, y, colWidthsMm: colW,
      head: [['সরবরাহকারীর নাম ও ঠিকানা', 'পণ্যের নাম ও পরিমান', 'মূল্য'], ['১', '২', '৩']],
      body: [[supplierLabelBn, `${d.goodsName}: ${plainNumber(d.goodsQty)} KG`, mc(d.costing.netFobFC, d.ccy)]],
      aligns: ['left', 'center', 'center'],
      fontSizePt: 8,
      cellPaddingMm: 1,
    });
    y += 2;
    y = noteTextBn(doc, y, d.t('noteD'), CONTENT_W);
  } else {
    const supplierLabel = application.kaForm?.supplierNameAddress || 'Self-collected / own arrangement';
    y = sectionHeading(doc, y, `(D) ${d.t('sectionD')}:`);
    autoTable(doc, {
      startY: y, head: [['Name & Address of Supplier', 'Name & Quantity of Goods', 'Value'], ['1', '2', '3']],
      body: [[supplierLabel, `${d.goodsName}: ${plainNumber(d.goodsQty)} KG`, `${d.ccy} ${d.M(d.costing.netFobFC)}`]],
      ...TABLE_STYLE,
    });
    y = doc.lastAutoTable.finalY + 2;
    y = noteText(doc, y, d.t('noteD'), CONTENT_W);
  }

  // Section E
  y = ensureSpace(y, 25 + d.shipments.length * (lang === 'bn' ? 9 : 6));
  if (lang === 'bn') {
    // R34: the real reference has EXACTLY 6 columns — NO separate serial/ক্রম column. The "১২৩৪৫৬"
    // row under the header is itself the column index (a numbering convention these government
    // forms use so accompanying notes/rules can refer to "column 3", etc.), not a per-row serial —
    // confirmed by counting header cells against data cells directly on the rasterized reference,
    // and it matches this round's own spec exactly ("the table MUST have exactly 6 columns").
    // Earlier rounds (see sectionERows' own comment above, still accurate for English) had found a
    // real Bengali reference with a genuine 7th SL column; that doesn't hold up against this fresh,
    // higher-quality reference. English is UNCHANGED — still the existing 7-column SL+6 layout a
    // couple of paragraphs down, since nothing here concerns the English form.
    // Ship-date uses a SLASH (DT DD/MM/YYYY), not the dot format sectionERows built for English/
    // DOCX/XLSX — rebuilt straight from d.shipments here rather than touching the shared row-
    // builder. Repatriated cell's date is pulled back out of sectionERows' own combined string
    // (it's already correct there, just joined with "/" instead of "DT:" + a leading € symbol).
    y = sectionHeadingBn(doc, y, 'E', d.t('sectionE'), CONTENT_W);
    const symbol = ccySymbol(d.ccy);
    const bodyRowsE = d.shipments.map((s, i) => {
      const row = d.sectionERows[i];
      const repatDateDot = (row[6].split(' / ')[1] || '').trim();
      return [
        row[1], row[2], `${symbol} ${row[3]}`, `DT ${formatDateRaw(s.date, '/')}`, row[5],
        `${symbol} ${row[3]}${repatDateDot ? ` DT: ${repatDateDot}` : ''}`,
      ];
    });
    const colW = [CONTENT_W * 0.18, CONTENT_W * 0.14, CONTENT_W * 0.20, CONTENT_W * 0.16, CONTENT_W * 0.13, CONTENT_W * 0.19];
    y = bnDrawGridTable(doc, {
      x: MARGIN, y, colWidthsMm: colW,
      head: [
        ['পণ্যের বর্ণনা', 'পরিমাণ', 'ইনভয়েসের মূল্য (বৈদেশিক মুদ্রায়)', 'জাহাজীকরণের তারিখ', 'ইএক্সপি নাম্বার', 'বৈদেশিকমুদ্রায় প্রত্যাবাসিত রপ্তানি মূল্য ও প্রত্যাবাসনের তারিখ'],
        ['১', '২', '৩', '৪', '৫', '৬'],
      ],
      body: bodyRowsE,
      // "TOTAL" stays in English/Latin — confirmed from the reference, which uses the Latin word
      // here rather than "মোট" even though the rest of the row (and every other label on the page)
      // is Bengali.
      foot: [['TOTAL', `${plainNumber(d.totalGrossWeightKg)} KG`, mc(d.costing.totalRepatriatedFC, d.ccy), '', '', mc(d.costing.totalRepatriatedFC, d.ccy)]],
      aligns: ['left', 'center', 'center', 'center', 'center', 'center'],
      fontSizePt: 7.6,
      cellPaddingMm: 0.9,
    });
    y += 2;
    y = noteTextBn(doc, y, d.t('noteE'), CONTENT_W);
  } else {
    y = sectionHeading(doc, y, `(E) ${d.t('sectionE')}:`);
    autoTable(doc, {
      startY: y, head: [['SL', 'Description of Goods', 'Quantity', 'Invoice Value (In Foreign Currency)', 'Date of Shipment', 'EXP No. & Date', 'Repatriated Export Value (In Foreign Currency) & Date of Repatriation']],
      body: d.sectionERows,
      foot: [['', 'TOTAL', `${plainNumber(d.totalGrossWeightKg)} KG`, d.M(d.costing.totalRepatriatedFC), '', '', d.M(d.costing.totalRepatriatedFC)]],
      ...TABLE_STYLE,
    });
    y = doc.lastAutoTable.finalY + 2;
    y = noteText(doc, y, d.t('noteE'), CONTENT_W);
  }

  // Section F — a REAL 6-column table in both languages (Airway Bill + 5 numbered figure columns),
  // each shipment's own row carrying all 5 figures, PLUS a numbered "1 2 3 4 5" sub-header row —
  // confirmed visually against both reference PDFs. Previously only 3 columns existed here with the
  // other 3 figures squeezed into one merged footer text line, a real structural mismatch.
  const pct = d.incentivePct;
  const sectionFFullRows = d.sectionFFullRows;
  y = ensureSpace(y, 25 + d.shipments.length * 6);
  if (lang === 'bn') {
    // R34 — important: the underlying DATA (sectionFFullRows, above) was ALREADY CORRECT before
    // this round — [awbNo, repat, freight, commission, netFob, incentive] — verified by hand
    // against the current PDF's own printed numbers (row 1: repat 10,988 − freight 8,000 −
    // commission 0(N/A) = netFob 2,988, matching exactly what it already printed). The actual bug
    // was PURELY in this Bengali head[] text below: column 2 (which holds `repat`) was labeled
    // "ইনভয়েসের মূল্য" (invoice value) instead of "প্রত্যাবাসিত রপ্তানী মূল্য" (repatriated value);
    // column 3 (which holds `freight`) was labeled "প্রত্যাবাসিত রপ্তানী মূল্য" instead of a freight-
    // amount header; and freight+commission were folded into one combined header even though
    // they're genuinely two separate columns. The English head[] just below (unchanged) already
    // has the correct 6 labels lined up against this exact same row array — that's what confirmed
    // the row data itself needed no changes, only this table's own header text. Also: the reference
    // leaves the incentive figure BLANK on every individual data row and shows it only once, in the
    // TOTAL row (confirmed row-by-row on the rasterized reference) — Bengali-specific, English's
    // own per-row incentive display a little further down is untouched.
    y = sectionHeadingBn(doc, y, 'F', d.t('sectionF'), CONTENT_W);
    const symbol = ccySymbol(d.ccy);
    const bodyRowsF = sectionFFullRows.map(([awb, repat, freight, commission, netFob]) => [
      awb, `${symbol} ${repat}`, `${symbol} ${freight}`, commission, `${symbol} ${netFob}`, '',
    ]);
    const colW = [CONTENT_W * 0.14, CONTENT_W * 0.15, CONTENT_W * 0.19, CONTENT_W * 0.19, CONTENT_W * 0.16, CONTENT_W * 0.17];
    y = bnDrawGridTable(doc, {
      x: MARGIN, y, colWidthsMm: colW,
      head: [
        ['এয়ারওয়ে বিল/বি.এল নম্বর', 'প্রত্যাবাসিত রপ্তানীমূল্য (বৈদেশিক মুদ্রায়)', 'প্রযোজ্য ক্ষেত্রে জাহাজ ভাড়ার পরিমাণ', 'বৈদেশিক মুদ্রায় বিদেশে পরিশোধিত কমিশন, ইনস্যুরেন্স ইত্যাদি (যদি থাকে)', 'নীট এফওবি রপ্তানী মূল্য (১)-(২+৩)', 'প্রাপ্য ভর্তুকী (৪)x১০%x১০০'],
        ['', '১', '২', '৩', '৪', '৫'],
      ],
      body: bodyRowsF,
      foot: [['TOTAL', mc(d.costing.totalRepatriatedFC, d.ccy), mc(d.costing.totalFreightFC, d.ccy), d.commissionLabel, mc(d.costing.netFobFC, d.ccy), mc(d.costing.incentiveReceivableFC, d.ccy)]],
      aligns: ['left', 'center', 'center', 'center', 'center', 'center'],
      fontSizePt: 7.6,
      cellPaddingMm: 0.9,
    });
    y += 2;
    y = noteTextBn(doc, y, d.t('noteF'), CONTENT_W);
  } else {
    y = sectionHeading(doc, y, `(F) ${d.t('sectionF')}:`);
    autoTable(doc, {
      startY: y,
      head: [
        [{ content: 'Airway Bill / BL No.', rowSpan: 2, styles: { valign: 'middle' } }, 'Repatriated Export Value (In Foreign Currency)', 'Freight, if applicable (In Foreign Currency)', 'Commission, Insurance, etc., if any (In Foreign Currency)', 'Net FOB Export Value (1)-(2+3)', `Incentive Receivable (4)x${pct}/100`],
        ['1', '2', '3', '4', '5'],
      ],
      body: sectionFFullRows,
      foot: [['TOTAL', d.M(d.costing.totalRepatriatedFC), d.M(d.costing.totalFreightFC), '', d.M(d.costing.netFobFC), d.M(d.costing.incentiveReceivableFC)]],
      ...TABLE_STYLE,
    });
    y = doc.lastAutoTable.finalY + 2;
    y = noteText(doc, y, d.t('noteF'), CONTENT_W);
  }

  // Section G
  y = ensureSpace(y, 40);
  if (lang === 'bn') {
    y = sectionHeadingBn(doc, y, 'G', d.t('sectionG'), CONTENT_W);
    y = drawBengaliText(doc, d.t('declaration'), MARGIN, y, { sizePt: 8.3, maxWidthMm: CONTENT_W, align: 'left', lineGapMm: 0.6 }) + 3.5;
    y = drawBengaliText(doc, 'তারিখঃ ....... / ....... / ...............', MARGIN, y, { sizePt: 8, maxWidthMm: CONTENT_W * 0.5, align: 'left' });
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
    doc.line(PAGE_W - MARGIN - 70, y - 1, PAGE_W - MARGIN, y - 1);
    drawBengaliText(doc, d.t('signatoryLine'), PAGE_W - MARGIN - 70, y + 1, { sizePt: 7, maxWidthMm: 70, align: 'center' });
    y += 9;
  } else {
    y = sectionHeading(doc, y, `(G) ${d.t('sectionG')}:`);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
    const declLines = doc.splitTextToSize(d.t('declaration'), CONTENT_W);
    doc.text(declLines, MARGIN, y); y += declLines.length * 3.6 + 4;
    doc.text('Date: ....... / ....... / ...............', MARGIN, y);
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
    doc.line(PAGE_W - MARGIN - 70, y - 3, PAGE_W - MARGIN, y - 3);
    doc.setFontSize(7.5);
    const sigLines = doc.splitTextToSize(d.t('signatoryLine'), 70);
    doc.text(sigLines, PAGE_W - MARGIN - 70, y + 1);
    y += Math.max(8, sigLines.length * 3.2 + 4);
  }

  // Section H — English keeps the long descriptive column headers directly (no numbered sub-row).
  // Bengali ALSO now gets full descriptive headers (previously this table showed ONLY the numbering
  // row "১ ২ ৩ ৪" with no header text at all above it — a real gap, not a shorter-labels choice; the
  // reference has full multi-line headers for all 4 columns, confirmed by rasterizing it). The
  // caption sentence that used to be drawn standalone above the table is now column 4's own header
  // text instead, matching the reference exactly (it's genuinely inside the table there, not a
  // caption above it). The citation that used to be drawn right above this section has moved to the
  // very top of the page instead — see the header block near the top of this function.
  const rateLine = {
    en: `${d.M(d.costing.incentiveReceivableFC)} @ Tk. ${d.MBDT(d.effectiveRateBDT)}/${d.ccy} = Tk. ${d.MBDT(d.costing.payableIncentiveBDT)}`,
    // R34: Latin numerals + "BDT" text throughout (not Bengali-digit MBDT + "৳"/"টাকা") — confirmed
    // from the reference, which keeps this one specific line in Latin/English ("€ 2748.293 @ 144.5
    // BDT = 397127.905 BDT") even though literally everything else on the page is Bengali. d.M()
    // (moneyFC) is always-Latin already (see its own comment above), so this just swaps MBDT for M
    // and "টাকা"/"৳" for "BDT" at this one call site — no calculation changes. The reference sample
    // shows 1-3 decimal places here rather than this document's usual fixed 2 (e.g. "144.5", not
    // "144.50") — read as leftover from whoever pasted an unrounded spreadsheet value into that one
    // sample cell, not a deliberate template rule, so this keeps the same 2-decimal convention used
    // everywhere else in the document for internal consistency.
    bn: `${mc(d.costing.incentiveReceivableFC, d.ccy)} @ ${d.M(d.effectiveRateBDT)} BDT = ${d.M(d.costing.payableIncentiveBDT)} BDT`,
  };
  y = ensureSpace(y, 45);
  if (lang === 'bn') {
    y = sectionHeadingBn(doc, y, 'H', d.t('sectionH'), CONTENT_W);
    const colW = [CONTENT_W * 0.18, CONTENT_W * 0.26, CONTENT_W * 0.18, CONTENT_W * 0.38];
    y = bnDrawGridTable(doc, {
      x: MARGIN, y, colWidthsMm: colW,
      head: [
        ['প্রত্যাবাসিত রপ্তানীমূল্য (বৈদেশিক মুদ্রায়)', '(বৈদেশিক মুদ্রা বিদেশে পরিশোধিত কমিশন, ইনস্যুরেন্স ও প্রযোজ্য ক্ষেত্রে জাহাজ ভাড়া বাবদ মোট বিয়োজন)', 'নীট এফওবি রপ্তানীমূল্য (বৈদেশিক মুদ্রায়)', d.t('sectionHCaption')],
        ['১', '২', '৩', '৪'],
      ],
      body: [[mc(d.costing.totalRepatriatedFC, d.ccy), mc(d.costing.totalFreightFC + d.costing.commissionInsuranceFC, d.ccy), mc(d.costing.netFobFC, d.ccy), rateLine.bn]],
      aligns: ['center', 'center', 'center', 'center'],
      fontSizePt: 8,
      cellPaddingMm: 1,
    });
    y += 3.5;
    y = drawBengaliText(doc, 'পরিশোধিত ভর্তুকীর পরিমাণ টাকায়ঃ ( .................................................................... )   পরিশোধের তারিখঃ ....... / ....... / ...............', MARGIN, y, { sizePt: 8, maxWidthMm: CONTENT_W, align: 'left' }) + 5;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
    doc.line(PAGE_W - MARGIN - 80, y, PAGE_W - MARGIN, y);
    drawBengaliText(doc, d.t('bankSignatoryLine'), PAGE_W - MARGIN - 80, y + 2, { sizePt: 7, maxWidthMm: 80, align: 'center' });
  } else {
    y = sectionHeading(doc, y, `(H) ${d.t('sectionH')}:`);
    autoTable(doc, {
      startY: y, head: [['Repatriated Export Value (In Foreign Currency)', 'Total Deduction for Commission Paid Abroad, Insurance and Freight, if applicable (In Foreign Currency)', 'Net FOB Export Value (In Foreign Currency)', 'Payable Incentive Amount (in Taka: 3x10/100 of Export Value, at the TT Buying Rate of the Relevant Foreign Currency on the Date of Repatriation)']],
      body: [[d.M(d.costing.totalRepatriatedFC), d.M(d.costing.totalFreightFC + d.costing.commissionInsuranceFC), d.M(d.costing.netFobFC), rateLine.en]],
      ...TABLE_STYLE,
    });
    y = doc.lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Amount of Incentive Paid in Taka: ( ...................................................... )    Date of Payment: ....... / ....... / ...............', MARGIN, y);
    y += 10;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
    doc.line(PAGE_W - MARGIN - 80, y, PAGE_W - MARGIN, y);
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(d.t('bankSignatoryLine'), 80), PAGE_W - MARGIN - 80, y + 4);
  }

  return doc;
}

export async function downloadKaFormPDF(application, lang) {
  const doc = await generateKaFormPDF(application, lang);
  doc.save(`Ka-Form-${lang}-${application.title || application.applicationNumber}.pdf`);
}

// ---------------------------------------------------------------------------------------------
// DOCX (R21)
// ---------------------------------------------------------------------------------------------
export async function generateKaFormDOCX(application, lang = 'en') {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType } = await import('docx');
  const d = assembleKaFormData(application, lang);
  const P = (text, opts = {}) => new Paragraph({ alignment: opts.center ? AlignmentType.CENTER : undefined, spacing: { after: opts.after ?? 100 }, children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold, italics: !!opts.italics, size: opts.size || 18 })] });
  const cellP = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold, size: 16 })] });
  const rowsToTable = (head, body, foot) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: head.map((h) => new TableCell({ shading: { fill: 'EEEEEE' }, children: [cellP(h, { bold: true })] })) }),
      ...body.map((r) => new TableRow({ children: r.map((v) => new TableCell({ children: [cellP(v)] })) })),
      ...(foot ? [new TableRow({ children: foot.map((v) => new TableCell({ children: [cellP(v, { bold: true })] })) })] : []),
    ],
  });

  const doc = new Document({
    sections: [{
      children: [
        P(d.t('title'), { center: true, bold: true, size: 32, after: 60 }),
        P(d.t('citation'), { center: true, italics: true, size: 16, after: 100 }),
        P(d.t('subtitle1'), { center: true, bold: true, size: 22, after: 40 }),
        P(d.t('subtitle2'), { center: true, bold: true, size: 22, after: 200 }),

        P(`(A) ${d.t('sectionA')}:`, { bold: true, size: 20 }),
        P(d.applicantLine), P(`Export Registration Certificate (ERC) No.: ${d.license.ercNumber || ''}`, { after: 200 }),

        P(`(B) ${d.t('sectionB')}:`, { bold: true, size: 20 }),
        P(d.contractLine, { after: 200 }),

        P(`(C) ${d.t('sectionC')}:`, { bold: true, size: 20, after: 80 }),
        rowsToTable(['SL', 'TT No.', 'Date', `Value (${d.ccy})`], d.ttRows.map((r, i) => [String(i + 1), ...r]), ['', '', 'TOTAL', d.M(d.ttTotal)]),
        P(d.t('noteC'), { italics: true, size: 14, after: 200 }),

        P(`(D) ${d.t('sectionD')}:`, { bold: true, size: 20, after: 80 }),
        rowsToTable(['Name & Address of Supplier', 'Name & Quantity of Goods', 'Value'], [[application.kaForm?.supplierNameAddress || 'Self-collected / own arrangement', `${d.goodsName}: ${d.goodsQty} KG`, `${d.ccy} ${d.M(d.costing.netFobFC)}`]]),
        P(d.t('noteD'), { italics: true, size: 14, after: 200 }),

        P(`(E) ${d.t('sectionE')}:`, { bold: true, size: 20, after: 80 }),
        rowsToTable(['SL', 'Description', 'Qty', 'Invoice Value (In Foreign Currency)', 'Ship Date', 'EXP No. & Date', 'Repatriated Export Value (In Foreign Currency) & Date'], d.sectionERows, ['', 'TOTAL', `${d.totalGrossWeightKg} KG`, d.M(d.costing.totalRepatriatedFC), '', '', d.M(d.costing.totalRepatriatedFC)]),
        P(d.t('noteE'), { italics: true, size: 14, after: 200 }),

        P(`(F) ${d.t('sectionF')}:`, { bold: true, size: 20, after: 80 }),
        rowsToTable(
          ['Airway Bill / BL No.', '(1) Repatriated Export Value (In Foreign Currency)', '(2) Freight, if applicable (In Foreign Currency)', '(3) Commission, Insurance, etc., if any (In Foreign Currency)', '(4) Net FOB Export Value (1)-(2+3)', `(5) Incentive Receivable (${d.incentivePct}%)`],
          d.sectionFFullRows,
          ['TOTAL', d.M(d.costing.totalRepatriatedFC), d.M(d.costing.totalFreightFC), '', d.M(d.costing.netFobFC), d.M(d.costing.incentiveReceivableFC)],
        ),
        P(d.t('noteF'), { italics: true, size: 14, after: 200 }),

        P(`(G) ${d.t('sectionG')}:`, { bold: true, size: 20, after: 80 }),
        P(d.t('declaration'), { size: 16, after: 200 }),
        P('Date: ....... / ....... / ...............', { size: 16 }),
        P(d.t('signatoryLine'), { size: 14, after: 300 }),

        P(`(H) ${d.t('sectionH')}:`, { bold: true, size: 20, after: 80 }),
        rowsToTable(
          ['Repatriated Export Value (In Foreign Currency)', 'Total Deduction for Commission Paid Abroad, Insurance and Freight, if applicable (In Foreign Currency)', 'Net FOB Export Value (In Foreign Currency)', 'Payable Incentive Amount (in Taka: 3x10/100 of Export Value, at the TT Buying Rate of the Relevant Foreign Currency on the Date of Repatriation)'],
          [[d.M(d.costing.totalRepatriatedFC), d.M(d.costing.totalFreightFC + d.costing.commissionInsuranceFC), d.M(d.costing.netFobFC), `${d.M(d.costing.incentiveReceivableFC)} @ Tk. ${d.MBDT(d.effectiveRateBDT)}/${d.ccy} = Tk. ${d.MBDT(d.costing.payableIncentiveBDT)}`]],
        ),
        P('Amount of Incentive Paid in Taka: ( ...................................................... )    Date of Payment: ....... / ....... / ...............', { size: 16, after: 300 }),
        P(d.t('bankSignatoryLine'), { size: 14 }),
      ],
    }],
  });
  return Packer.toBlob(doc);
}
export async function downloadKaFormDOCX(application, lang) {
  const blob = await generateKaFormDOCX(application, lang);
  downloadBlob(blob, `Ka-Form-${lang}-${application.title || application.applicationNumber}.docx`);
}

// ---------------------------------------------------------------------------------------------
// XLSX (R21)
// ---------------------------------------------------------------------------------------------
export function generateKaFormXLSX(application, lang = 'en') {
  const d = assembleKaFormData(application, lang);
  const rows = [
    [d.t('title')], [d.t('citation')], [d.t('subtitle1')], [d.t('subtitle2')], [],
    [`(A) ${d.t('sectionA')}`], [d.applicantLine], [`ERC No.: ${d.license.ercNumber || ''}`], [],
    [`(B) ${d.t('sectionB')}`], [d.contractLine], [],
    [`(C) ${d.t('sectionC')}`], ['SL', 'TT No.', 'Date', `Value (${d.ccy})`], ...d.ttRows.map((r, i) => [i + 1, ...r]), ['', '', 'TOTAL', d.M(d.ttTotal)], [d.t('noteC')], [],
    [`(D) ${d.t('sectionD')}`], ['Name & Address of Supplier', 'Name & Quantity of Goods', 'Value'],
    [application.kaForm?.supplierNameAddress || 'Self-collected / own arrangement', `${d.goodsName}: ${d.goodsQty} KG`, `${d.ccy} ${d.M(d.costing.netFobFC)}`], [d.t('noteD')], [],
    [`(E) ${d.t('sectionE')}`], ['SL', 'Description', 'Qty', 'Invoice Value (In Foreign Currency)', 'Ship Date', 'EXP No. & Date', 'Repatriated Export Value (In Foreign Currency) & Date'], ...d.sectionERows,
    ['', 'TOTAL', `${d.totalGrossWeightKg} KG`, d.M(d.costing.totalRepatriatedFC), '', '', d.M(d.costing.totalRepatriatedFC)], [d.t('noteE')], [],
    [`(F) ${d.t('sectionF')}`],
    ['Airway Bill / BL No.', '(1) Repatriated Export Value (In Foreign Currency)', '(2) Freight, if applicable (In Foreign Currency)', '(3) Commission, Insurance, etc., if any (In Foreign Currency)', '(4) Net FOB Export Value (1)-(2+3)', `(5) Incentive Receivable (${d.incentivePct}%)`],
    ...d.sectionFFullRows,
    ['TOTAL', d.M(d.costing.totalRepatriatedFC), d.M(d.costing.totalFreightFC), '', d.M(d.costing.netFobFC), d.M(d.costing.incentiveReceivableFC)],
    [d.t('noteF')], [],
    [`(G) ${d.t('sectionG')}`], [d.t('declaration')], ['Date: ....... / ....... / ...............'], [d.t('signatoryLine')], [],
    [`(H) ${d.t('sectionH')}`],
    ['Repatriated Export Value (In Foreign Currency)', 'Total Deduction for Commission Paid Abroad, Insurance and Freight, if applicable (In Foreign Currency)', 'Net FOB Export Value (In Foreign Currency)', 'Payable Incentive Amount (in Taka: 3x10/100 of Export Value, at the TT Buying Rate of the Relevant Foreign Currency on the Date of Repatriation)'],
    [d.M(d.costing.totalRepatriatedFC), d.M(d.costing.totalFreightFC + d.costing.commissionInsuranceFC), d.M(d.costing.netFobFC), `${d.M(d.costing.incentiveReceivableFC)} @ Tk. ${d.MBDT(d.effectiveRateBDT)}/${d.ccy} = Tk. ${d.MBDT(d.costing.payableIncentiveBDT)}`],
    ['Amount of Incentive Paid in Taka: ( ) ', 'Date of Payment: ....... / ....... / ...............'], [d.t('bankSignatoryLine')],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Ka Form');
  XLSX.writeFile(wb, `Ka-Form-${lang}-${application.title || application.applicationNumber}.xlsx`);
}

// ---------------------------------------------------------------------------------------------
// Stamp Application — PDF. R25 (issue 1): plain LEGAL-size paper, NEVER the letterhead (reversing
// part of R24 issue 9 for this document specifically). R24: forced to EXACTLY 3 pages, matching the
// reference PDFs' own pagination, via the {{PAGE_BREAK}} sentinel paragraphs inserted into
// DEFAULT_STAMP_TEXT at the same 2 points the real documents break (after paragraph 1; after the
// Applicant/নিবেদক signature line) — confirmed from both reference PDFs' own page boundaries
// (pdftotext form-feed positions line up exactly with those 2 points in both languages). Previously
// pagination was purely y-position-based overflow, which doesn't reliably reproduce 3 pages (depends
// on exactly how much text a given application's data produces). A custom admin text override won't
// contain the marker, so overflow-based pagination remains as a fallback for that case.
// ---------------------------------------------------------------------------------------------
export async function generateStampApplicationPDF(application, lang, { shipments, license, contract, bank }) {
  if (lang === 'bn') await ensureBengaliFontLoaded();
  const text = resolveStampApplicationText({ application, shipments, license, contract, bank, lang });
  const doc = new jsPDF({ unit: 'mm', format: 'legal' });
  const W = 215.9, H = 355.6, M = 20, CW = W - M * 2;
  const OVERFLOW_Y = H - 30, LINE_OVERFLOW_Y = H - 20;
  let y = M;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(0, 0, 0);
  const paragraphs = text.split('\n\n');
  const hasExplicitBreaks = paragraphs.some((p) => p.trim() === '{{PAGE_BREAK}}');

  paragraphs.forEach((para) => {
    const trimmed = para.trim();
    if (trimmed === '{{PAGE_BREAK}}') {
      doc.addPage();
      y = M;
      return;
    }
    const isTitle = trimmed === 'UNDERTAKING' || trimmed === 'অঙ্গীকারনামা';
    const isSignature = trimmed === 'Applicant' || trimmed === 'নিবেদক';
    // Overflow fallback only matters when there's no explicit marker to rely on (custom override).
    if (!hasExplicitBreaks && y > OVERFLOW_Y) { doc.addPage(); y = M; }
    if (isTitle) {
      if (lang === 'bn') {
        y = drawBengaliText(doc, trimmed, W / 2 - measureTextWidthMm(trimmed, 12, false) / 2, y, { sizePt: 12, bold: true, maxWidthMm: CW, align: 'left' }) + 4;
      } else {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
        doc.text(trimmed, W / 2, y, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
        y += 9;
      }
    } else if (isSignature) {
      if (lang === 'bn') {
        drawBengaliText(doc, trimmed, W - M - measureTextWidthMm(trimmed, 10.5, false), y, { sizePt: 10.5, maxWidthMm: CW, align: 'left' });
      } else {
        doc.text(trimmed, W - M, y, { align: 'right' });
      }
      y += 12;
    } else if (lang === 'bn') {
      const lines = wrapBengaliText(trimmed, 10.5, CW);
      lines.forEach((line) => {
        if (!hasExplicitBreaks && y > LINE_OVERFLOW_Y) { doc.addPage(); y = M; }
        y = drawBengaliText(doc, line, M, y, { sizePt: 10.5, maxWidthMm: CW, align: 'left' });
      });
      y += 4;
    } else {
      const lines = doc.splitTextToSize(trimmed, CW);
      lines.forEach((line) => {
        if (!hasExplicitBreaks && y > LINE_OVERFLOW_Y) { doc.addPage(); y = M; }
        doc.text(line, M, y, { align: 'left', maxWidth: CW });
        y += 5.2;
      });
      y += 4;
    }
  });
  return doc;
}
export async function downloadStampApplicationPDF(application, lang, ctx) {
  const doc = await generateStampApplicationPDF(application, lang, ctx);
  doc.save(`Stamp-Application-${lang}-${application.title || application.applicationNumber}.pdf`);
}

export async function generateStampApplicationDOCX(application, lang, ctx) {
  const { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType } = await import('docx');
  const text = resolveStampApplicationText({ application, ...ctx, lang });
  const paragraphs = text.split('\n\n').map((para) => {
    const trimmed = para.trim();
    if (trimmed === '{{PAGE_BREAK}}') {
      // A real Word page break, at the same 2 points the reference PDF itself breaks — matches the
      // PDF generator's own handling of this sentinel (see its own comment above).
      return new Paragraph({ children: [new PageBreak()] });
    }
    const isTitle = trimmed === 'UNDERTAKING' || trimmed === 'অঙ্গীকারনামা';
    const isSignature = trimmed === 'Applicant' || trimmed === 'নিবেদক';
    return new Paragraph({
      alignment: isTitle ? AlignmentType.CENTER : isSignature ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { after: 240 },
      children: [new TextRun({ text: trimmed, bold: isTitle, underline: isTitle ? {} : undefined, size: isTitle ? 26 : 22 })],
    });
  });
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(doc);
}
export async function downloadStampApplicationDOCX(application, lang, ctx) {
  const blob = await generateStampApplicationDOCX(application, lang, ctx);
  downloadBlob(blob, `Stamp-Application-${lang}-${application.title || application.applicationNumber}.docx`);
}

export function generateStampApplicationXLSX(application, lang, ctx) {
  const text = resolveStampApplicationText({ application, ...ctx, lang });
  // The {{PAGE_BREAK}} sentinel is a PDF/print pagination concept only — Excel has no equivalent
  // notion of "page" for a flowing text document like this, so it's simply dropped here rather than
  // printed as literal text (a blank row keeps the same paragraph-separation spacing instead).
  const rows = text.split('\n\n').map((para) => (para.trim() === '{{PAGE_BREAK}}' ? [''] : [para.trim()]));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Stamp Application');
  XLSX.writeFile(wb, `Stamp-Application-${lang}-${application.title || application.applicationNumber}.xlsx`);
}
