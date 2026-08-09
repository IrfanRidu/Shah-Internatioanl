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
    citation: '(অনুচ্ছেদ ৩(খ), এফই সার্কুলার নং-১৫/২০০৫ দ্রষ্টব্য)',
    subtitle1: 'কৃষিপণ্য (পান, শাক-সবজি ও ফলমূল) রপ্তানীর বিপরীতে ভর্তুকীর জন্য আবেদনপত্র',
    subtitle2: '',
    sectionA: 'আবেদনকারীর নাম ও ঠিকানা',
    sectionB: 'রপ্তানী ঋণপত্র / চুক্তিপত্রের নম্বর, তারিখ ও মূল্য',
    sectionC: 'টিটি নম্বর, তারিখ ও মূল্য',
    noteC: '(বিদেশ হইতে টিটির মাধ্যমে রপ্তানী মূল্য প্রত্যাবাসিত হইলে, প্রাপ্ত অর্থ সংশ্লিষ্ট রপ্তানীর বিপরীতে হইবার বিষয়টি টিটির ভাষ্য হইতে ব্যাংক কর্তৃক নিশ্চিত হইয়া লইতে হইবে।)',
    sectionD: 'রপ্তানীকৃত পণ্যের সংগ্রহ সূত্র',
    noteD: 'রপ্তানী পণ্যের নাম, পরিমাণ, মূল্য এবং সংগ্রহসূত্রের বিষয়ে রপ্তানী উন্নয়ন ব্যুরো / সংশ্লিষ্ট এসোসিয়েশন প্রদত্ত সনদপত্র দাখিল করিতে হইবে।',
    sectionE: 'রপ্তানী চালানের বিবরণ',
    noteE: 'রপ্তানী ইনভয়েস, প্যাকিং লিস্ট এবং বিল অব লেডিং / এয়ারওয়ে বিল ইত্যাদি সত্যায়িত আলোচনাযোগ্য কপি এবং রপ্তানী মূল্য প্রত্যাবাসন সনদপত্র (পিআরসি) দাখিল করিতে হইবে।',
    sectionF: 'ভর্তুকীর আবেদনকৃত পরিমাণ',
    noteF: '(প্রযোজ্য ক্ষেত্রে জাহাজ ভাড়ার উল্লেখ সম্বলিত ফ্রেইট সার্টিফিকেটের সত্যায়িত কপি দাখিল করিতে হইবে।)',
    sectionG: 'ঘোষণা',
    declaration: 'ঘোষণা করা যাইতেছে যে, সম্পূর্ণ দেশীয় কৃষি পণ্য (শাক-সবজি, ফলমূল) রপ্তানীর বিপরীতে ভর্তুকীর আবেদন করা হইল। এই আবেদনপত্রে প্রদত্ত তথ্যাদি সম্পূর্ণ সঠিক। পরবর্তীতে ইহাতে কোন ভুল/অসত্য/প্রতারণা/জালিয়াতি প্রমাণিত হইলে গৃহীত ভর্তুকীর সমুদয় অর্থ বা উহার অংশবিশেষ আমার/আমাদের ব্যাংক হিসাব হইতে আদায় করিয়া লওয়া হইবে।',
    signatoryLine: 'আবেদনকারীর প্রতিষ্ঠানের স্বত্বাধিকারী / ক্ষমতাপ্রাপ্ত কর্মকর্তার স্বাক্ষর ও পদবী',
    sectionH: 'ভর্তুকী প্রদানকারী ব্যাংক শাখা কর্তৃক পূরণীয়',
    sectionHCaption: 'পরিশোধযোগ্য ভর্তুকীর পরিমাণ (টাকায়ঃ ৩x১০% রপ্তানী মূল্য, প্রত্যাবাসনের তারিখে সংশ্লিষ্ট বৈদেশিক মুদ্রার টিটি ক্রয়মূল্য হারে)',
    bankSignatoryLine: 'ভর্তুকী অনুমোদনের ক্ষমতাপ্রাপ্ত ব্যাংক কর্মকর্তার স্বাক্ষর, নাম ও পদবী',
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

// R19's exact sequence rule, confirmed against the real reference sample: first EXP gets a
// -{year} suffix, middle ones are bare, last gets -{year} again, comma-separated with "and" before
// the last. Same shape for shipment dates (just plain dates, no year-suffix logic).
function buildExpSequence(shipments, lang) {
  const parts = shipments.map((s, i) => {
    const year = s.expDate ? new Date(s.expDate).getFullYear() : (s.date ? new Date(s.date).getFullYear() : '');
    const withYear = i === 0 || i === shipments.length - 1;
    const text = withYear && year ? `${s.expNo || ''}-${year}` : (s.expNo || '');
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
  // Issue 4 (R25): "EXP No. & Date" must show EXPNO/YEAR (matching the reference — e.g.
  // "000367/2026"), but the year was always coming out blank. Root cause: expDate is a real schema
  // field but had no input anywhere in the shipment editor to ever actually set it, so it was always
  // null. Added that input (issue 4's own fix, shipment editor page), but that only helps shipments
  // saved from now on — this ALSO falls back to the shipment's own (always-populated, required)
  // date field's year for anything saved before that existed, so the year is never simply missing.
  const expNoWithYear = (s) => {
    const year = s.expDate ? new Date(s.expDate).getFullYear() : (s.date ? new Date(s.date).getFullYear() : '');
    return `${s.expNo || ''}/${year}`;
  };
  // English reference: 7 columns, EXP No.&Date and Repatriated Value&Date are SEPARATE columns.
  const sectionERows = shipments.map((s, i) => {
    const invoiceValueFC = (Number(s.orderValueForeign) || 0) + (Number(s.freightCost) || 0);
    const tt = latestTT(s.ttEntries);
    return [
      localizeNumber(i + 1, lang), category.name || '', `${plainNumber(s.totalGrossWeightKg || 0)} KG`,
      M(invoiceValueFC), DDot(s.date), expNoWithYear(s),
      `${M(invoiceValueFC)} / ${tt ? DDot(tt.ttDate) : ''}`,
    ];
  });
  // Bengali reference: only 6 columns — EXP No./year and repatriated value/date are stacked into ONE
  // cell under a single "ইএক্সপি নম্বর ও তারিখ" header, confirmed visually (narrower A4 page, no room
  // for a 7th column). Structurally different from English, not just narrower text.
  const sectionERowsBn = shipments.map((s, i) => {
    const invoiceValueFC = (Number(s.orderValueForeign) || 0) + (Number(s.freightCost) || 0);
    const tt = latestTT(s.ttEntries);
    return [
      localizeNumber(i + 1, lang), category.name || '', `${plainNumber(s.totalGrossWeightKg || 0)} KG`,
      M(invoiceValueFC), DDot(s.date),
      `${expNoWithYear(s)}\n${M(invoiceValueFC)} / ${tt ? DDot(tt.ttDate) : ''}`,
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
    totalGrossWeightKg, ttRows, ttTotal, goodsName, goodsQty, sectionERows, sectionERowsBn,
    sectionFFullRows, incentivePct, commissionLabel,
    applicantLine: license.licenseName ? `${license.licenseName}, ${license.address || ''}` : '',
    contractLine: contract.contractNo ? `${contract.contractNo}, ${lang === 'bn' ? '' : 'dated '}${DDot(contract.date)}, ${ccy} ${M(contract.value)}` : '',
  };
}

// ---------------------------------------------------------------------------------------------
// PDF — R25 (issue 1): Ka Form is now ALWAYS plain A3 for both languages, and NEVER uses the
// letterhead — reversing part of R24's issue 9 for this document specifically. English's own
// reference was already A3; Bengali's reference PDF was A4, but the explicit ask this round is a
// single guaranteed page for anywhere from 1 to 7 shipments (this app's own hard min/max group
// size) with no letterhead reserve, and A3's extra room makes that reliable rather than tight. The
// Bengali-specific content structure (6-column Section E, single-table Section C, numbered Section H
// — all confirmed against the real Bengali reference PDF) is unchanged, just rendered on the larger
// canvas. No letterhead means no reserved top margin either — content starts at the plain MARGIN.
// ---------------------------------------------------------------------------------------------
const MARGIN = 14;
function pageGeometry() {
  const PAGE_W = 297, PAGE_H = 420;
  return { PAGE_W, PAGE_H, CONTENT_W: PAGE_W - MARGIN * 2 };
}
const TABLE_STYLE = {
  theme: 'grid',
  // Gray (232,232,232) sampled directly from the reference PDF's own header-row fill — was plain
  // white before, a real visual mismatch against "exact format" (issue 4).
  headStyles: { fillColor: [232, 232, 232], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2, fontSize: 8 },
  bodyStyles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.15, fontSize: 8 },
  footStyles: { fillColor: [232, 232, 232], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2, fontSize: 8 },
  styles: { cellPadding: 1.6, font: 'helvetica' },
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
  return drawBengaliText(doc, `(${BN_SECTION_LETTERS[letter] || letter}) ${text} ঃ`, MARGIN, y, { sizePt: 10, bold: true, maxWidthMm: contentW, align: 'left' }) + 1.5;
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
function bnDrawGridTable(doc, { x, y, colWidthsMm, head = [], body = [], foot = [], aligns, fontSizePt = 8, cellPaddingMm = 1.0 }) {
  const colAligns = aligns || colWidthsMm.map(() => 'center');
  let cursorY = y;
  const drawRow = (row, bold, shaded) => {
    const innerWidths = colWidthsMm.map((w) => w - cellPaddingMm * 2);
    const cellLineSets = row.map((cellRaw, ci) => bnCellLines(doc, cellRaw, fontSizePt, innerWidths[ci]));
    const rowH = Math.max(fontSizePt * MM_PER_PT * 1.28 + cellPaddingMm * 2, ...cellLineSets.map((lines) => lines.reduce((s, l) => s + l.heightMm, 0) + cellPaddingMm * 2));
    let cx = x;
    row.forEach((cellRaw, ci) => {
      const w = colWidthsMm[ci];
      if (shaded) { doc.setFillColor(232, 232, 232); doc.rect(cx, cursorY, w, rowH, 'F'); }
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
  head.forEach((row) => drawRow(row, true, true));
  body.forEach((row) => drawRow(row, false, false));
  foot.forEach((row) => drawRow(row, true, true));
  return cursorY;
}

export async function generateKaFormPDF(application, lang = 'en') {
  if (lang === 'bn') await ensureBengaliFontLoaded();
  const d = assembleKaFormData(application, lang);
  const { PAGE_W, PAGE_H, CONTENT_W } = pageGeometry();
  const doc = new jsPDF({ unit: 'mm', format: 'a3' });
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
    y = drawBengaliText(doc, d.t('title'), PAGE_W / 2 - measureTextWidthMm(d.t('title'), 15, false) / 2, y, { sizePt: 15, bold: true, maxWidthMm: CONTENT_W, align: 'left' }) + 1;
    y = drawBengaliText(doc, d.t('subtitle1'), MARGIN, y, { sizePt: 10.5, bold: true, maxWidthMm: CONTENT_W, align: 'center' }) + 3;
    // Bengali citation sits above Section H, not under the title — see below.
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
    y = sectionHeadingBn(doc, y, 'A', d.t('sectionA'), CONTENT_W);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    doc.text(d.applicantLine || '—', MARGIN, y); y += 4.5;
    y = drawBengaliText(doc, `রপ্তানী নিবন্ধন সনদপত্র (ERC) নম্বরঃ ${d.license.ercNumber || ''}`, MARGIN, y, { sizePt: 9, maxWidthMm: CONTENT_W, align: 'left' }) + 2.5;
  } else {
    y = sectionHeading(doc, y, `(A) ${d.t('sectionA')}:`);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(d.applicantLine || '—', MARGIN, y); y += 4.5;
    doc.text(ercLine, MARGIN, y); y += 7;
  }

  // Section B
  if (lang === 'bn') {
    y = sectionHeadingBn(doc, y, 'B', d.t('sectionB'), CONTENT_W);
    y = drawBengaliText(doc, d.contractLine || '—', MARGIN, y, { sizePt: 9, maxWidthMm: CONTENT_W, align: 'left' }) + 3.5;
  } else {
    y = sectionHeading(doc, y, `(B) ${d.t('sectionB')}:`);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(d.contractLine || '—', MARGIN, y); y += 8;
  }

  // Section C — TT list. English splits into two side-by-side 5-row-capped tables once there are
  // more than 5 rows (confirmed visually: left column is always exactly 5 rows, remainder + TOTAL
  // go right); Bengali keeps a single full-width table regardless of row count (narrower A4 page,
  // confirmed the same way — no room to split).
  y = ensureSpace(y, 20 + Math.min(d.ttRows.length, 6) * 6);
  if (lang === 'bn') {
    y = sectionHeadingBn(doc, y, 'C', d.t('sectionC'), CONTENT_W);
    const colW = [CONTENT_W * 0.09, CONTENT_W * 0.35, CONTENT_W * 0.24, CONTENT_W * 0.32];
    y = bnDrawGridTable(doc, {
      x: MARGIN, y, colWidthsMm: colW,
      head: [['ক্রম', 'টিটি নম্বর', 'তারিখ', `মূল্য (${ccyLabel(d.ccy, lang)})`]],
      body: d.ttRows.map((r, i) => [localizeNumber(i + 1, lang), r[0], r[1], r[2]]),
      foot: [['', '', 'মোট', d.M(d.ttTotal)]],
      aligns: ['center', 'center', 'center', 'right'],
    });
    y += 2;
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
  const supplierLabel = application.kaForm?.supplierNameAddress || (lang === 'bn' ? 'রপ্তানী পণ্য নিজস্ব উদ্যোগে সংগৃহীত' : 'Self-collected / own arrangement');
  if (lang === 'bn') {
    y = sectionHeadingBn(doc, y, 'D', d.t('sectionD'), CONTENT_W);
    const colW = [CONTENT_W * 0.32, CONTENT_W * 0.38, CONTENT_W * 0.30];
    y = bnDrawGridTable(doc, {
      x: MARGIN, y, colWidthsMm: colW,
      head: [['সরবরাহকারীর নাম ও ঠিকানা', 'পণ্যের নাম ও পরিমাণ', 'মূল্য']],
      body: [[supplierLabel, `${d.goodsName}: ${plainNumber(d.goodsQty)} KG`, `${ccyLabel(d.ccy, lang)}${d.M(d.costing.netFobFC)}`]],
      aligns: ['left', 'left', 'right'],
    });
    y += 2;
    y = noteTextBn(doc, y, d.t('noteD'), CONTENT_W);
  } else {
    y = sectionHeading(doc, y, `(D) ${d.t('sectionD')}:`);
    autoTable(doc, {
      startY: y, head: [['Name & Address of Supplier', 'Name & Quantity of Goods', 'Value']],
      body: [[supplierLabel, `${d.goodsName}: ${plainNumber(d.goodsQty)} KG`, `${d.ccy} ${d.M(d.costing.netFobFC)}`]],
      ...TABLE_STYLE,
    });
    y = doc.lastAutoTable.finalY + 2;
    y = noteText(doc, y, d.t('noteD'), CONTENT_W);
  }

  // Section E — English: 7 columns (EXP No.&Date and Repatriated Value&Date separate). Bengali: 6
  // columns (those two merged into one stacked cell) — confirmed visually, a real structural
  // difference driven by the narrower A4 page, not just a translation.
  y = ensureSpace(y, 25 + d.shipments.length * (lang === 'bn' ? 9 : 6));
  if (lang === 'bn') {
    y = sectionHeadingBn(doc, y, 'E', d.t('sectionE'), CONTENT_W);
    const colW = [CONTENT_W * 0.06, CONTENT_W * 0.17, CONTENT_W * 0.13, CONTENT_W * 0.19, CONTENT_W * 0.15, CONTENT_W * 0.30];
    y = bnDrawGridTable(doc, {
      x: MARGIN, y, colWidthsMm: colW,
      head: [['ক্রম', 'পণ্যের বিবরণ', 'পরিমাণ', 'ইনভয়েসের মূল্য\n(বৈদেশিক মুদ্রায়)', 'জাহাজীকরণের\nতারিখ', 'ইএক্সপি নম্বর ও তারিখ']],
      body: d.sectionERowsBn,
      foot: [['', 'মোট', `${plainNumber(d.totalGrossWeightKg)} KG`, d.M(d.costing.totalRepatriatedFC), '', d.M(d.costing.totalRepatriatedFC)]],
      aligns: ['center', 'left', 'center', 'right', 'center', 'center'],
      fontSizePt: 6.8,
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
    y = sectionHeadingBn(doc, y, 'F', d.t('sectionF'), CONTENT_W);
    const colW = [CONTENT_W * 0.18, CONTENT_W * 0.16, CONTENT_W * 0.16, CONTENT_W * 0.18, CONTENT_W * 0.16, CONTENT_W * 0.16];
    y = bnDrawGridTable(doc, {
      x: MARGIN, y, colWidthsMm: colW,
      head: [
        ['এয়ারওয়ে বিল /\nবি.এল নম্বর', 'ইনভয়েসের মূল্য\n(বৈদেশিক মুদ্রায়)', 'প্রত্যাবাসিত রপ্তানী মূল্য\n(বৈদেশিক মুদ্রায়)', 'জাহাজ ভাড়া, কমিশন,\nইন্স্যুরেন্স ইত্যাদি (যদি থাকে)', 'নীট এফওবি রপ্তানী মূল্য\n(১)-(২+৩)', 'প্রাপ্য ভর্তুকী\n(৪)x১০/১০০'],
        ['', '১', '২', '৩', '৪', '৫'],
      ],
      body: sectionFFullRows,
      foot: [['মোট', d.M(d.costing.totalRepatriatedFC), d.M(d.costing.totalFreightFC), '', d.M(d.costing.netFobFC), d.M(d.costing.incentiveReceivableFC)]],
      aligns: ['center', 'right', 'right', 'center', 'right', 'right'],
      fontSizePt: 6.8,
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
    y = drawBengaliText(doc, d.t('declaration'), MARGIN, y, { sizePt: 8.3, maxWidthMm: CONTENT_W, align: 'left', lineGapMm: 0.7 }) + 4;
    y = drawBengaliText(doc, 'তারিখঃ ....... / ....... / ...............', MARGIN, y, { sizePt: 8.3, maxWidthMm: CONTENT_W * 0.5, align: 'left' });
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
    doc.line(PAGE_W - MARGIN - 70, y - 1, PAGE_W - MARGIN, y - 1);
    drawBengaliText(doc, d.t('signatoryLine'), PAGE_W - MARGIN - 70, y + 1, { sizePt: 7, maxWidthMm: 70, align: 'center' });
    y += 10;
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

  // Section H — English keeps the long descriptive column headers directly (no numbered sub-row, no
  // caption/citation above — the citation already appeared under the title). Bengali uses short
  // numbered headers referencing Section F's own numbering, with a caption line AND the citation
  // (which sits here, not under the title) above the table — confirmed visually, a real structural
  // difference, not just shorter labels.
  const rateLine = { en: `${d.M(d.costing.incentiveReceivableFC)} @ Tk. ${d.MBDT(d.effectiveRateBDT)}/${d.ccy} = Tk. ${d.MBDT(d.costing.payableIncentiveBDT)}`, bn: `${d.M(d.costing.incentiveReceivableFC)} @ ${d.MBDT(d.effectiveRateBDT)} টাকা/${ccyLabel(d.ccy, lang)} = ৳${d.MBDT(d.costing.payableIncentiveBDT)}` };
  y = ensureSpace(y, 45);
  if (lang === 'bn') {
    y = drawBengaliText(doc, d.t('citation'), MARGIN, y, { sizePt: 7.5, italic: true, color: [60, 60, 60], maxWidthMm: CONTENT_W, align: 'left' }) + 2;
    y = sectionHeadingBn(doc, y, 'H', d.t('sectionH'), CONTENT_W);
    y = drawBengaliText(doc, d.t('sectionHCaption'), MARGIN, y, { sizePt: 8, maxWidthMm: CONTENT_W, align: 'left', lineGapMm: 0.5 }) + 2;
    const colW = [CONTENT_W * 0.25, CONTENT_W * 0.25, CONTENT_W * 0.25, CONTENT_W * 0.25];
    y = bnDrawGridTable(doc, {
      x: MARGIN, y, colWidthsMm: colW,
      head: [['১', '২', '৩', '৪']],
      body: [[d.M(d.costing.totalRepatriatedFC), d.M(d.costing.totalFreightFC + d.costing.commissionInsuranceFC), d.M(d.costing.netFobFC), rateLine.bn]],
      aligns: ['right', 'right', 'right', 'right'],
    });
    y += 4;
    y = drawBengaliText(doc, 'পরিশোধিত ভর্তুকীর পরিমাণ টাকায়ঃ ( .................................................................... )   পরিশোধের তারিখঃ ....... / ....... / ...............', MARGIN, y, { sizePt: 8.3, maxWidthMm: CONTENT_W, align: 'left' }) + 6;
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
