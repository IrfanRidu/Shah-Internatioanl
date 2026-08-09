# Ka Form & Stamp Application — Reference Extraction (source: 3 PDFs uploaded alongside R18-23)

Source files (in /mnt/user-data/uploads/, NOT copied into the app — this doc is the durable record):
Form_KA_Incentive_Application_English.pdf (1 page), Stamp_Application_English.pdf (3 pages),
Stamp_Application_Bangla.pdf (3 pages, clean embedded Noto Sans Bengali font — pdftotext gives
perfect Unicode, no OCR/garbling involved despite how it looked when pasted into chat earlier).
Extracted via `pdftotext -layout` + visual rasterization cross-check (both agree). This file is the
single source of truth for lib/kaFormDocuments.js — read THIS, not the original chat message, if
the two ever seem to disagree (this one has the full 3-page Stamp Application + Ka Form Sections
G/H, which the original prose spec didn't mention at all).

## KA FORM — confirmed 8 sections (A-H), NOT 6 (A-F) as the original prose spec implied

Title block (centered, top of page): `FORM "KA"` (large bold) / `(Paragraph 3(Kha), FE Circular
No. 15/2005)` (small, right under title — legal citation, NOT down by Section H despite where a
naive read of the raw text stream places it — confirmed by rasterizing the actual page) /
`APPLICATION FOR CASH INCENTIVE AGAINST EXPORT OF AGRICULTURAL PRODUCTS` / `(BETEL LEAF, VEGETABLES
AND FRUITS)` — this parenthetical is FIXED boilerplate (the incentive scheme's own official name),
editable like everything else but does NOT track the selected Export Category dynamically.

**(A) NAME AND ADDRESS OF THE APPLICANT** — one line: `{licenseName}, {licenseAddress}`. Then
`Export Registration Certificate (ERC) No.: {ercNumber}`. Both ← ExportLicense.

**(B) EXPORT L/C / CONTRACT NO., DATE & VALUE** — one line: `{contractNo}, dated {date DD/MM/YYYY},
{CCY} {value}` ← ExportContract. Value formatted South-Asian/lakh style (`5,00,000.00`, NOT
`500,000.00`) — confirmed from the sample; `Intl.NumberFormat('en-IN')` produces this natively.

**(C) TT NO., DATE & VALUE** — table: SL | TT No. | Date | Value (CCY). One row per TT entry,
flattened across every member shipment (a shipment with 2 TT entries contributes 2 rows). TOTAL
row sums Value only. PDF renders this as two side-by-side half-width tables once rows exceed ~5 (a
space-saving wrap, same spirit as this app's own existing "5-per-row" shipment-card grids) — NOT
replicating that specific two-column split (adds real jsPDF/autoTable complexity — two independent
table calls with manual X-offsets — for a cosmetic-only difference); a single full-width table reads
identically and A3 has plenty of room. Noted as a deliberate simplification.
Below: italic note, editable boilerplate: *"(If the export value is repatriated from abroad by TT,
the bank must satisfy itself, from the wording of the TT, that the amount received relates to the
export against which the claim is being made, before accepting it.)"*

**(D) SOURCE OF COLLECTION OF THE EXPORTED GOODS** — ONE data row, 3-column table: Name & Address
of Supplier | Name & Quantity of Goods | Value.
- Supplier: sample shows **exactly one combined field**, not separate name+address —
  `"Self-collected / own arrangement"` — this is the real default text (I don't need to invent one).
  Modeled as a single editable string, not two fields.
- Name & Quantity: rendered as `"{goodsName}: {quantity} KG"` e.g. `"Vegetables & Fruits: 1,035 KG"`.
  goodsName defaults to Export Category name; quantity — **the sample's 1,035 KG does NOT equal
  Section E's own total gross weight (14,690 KG) in this demo**, which contradicts the original
  prose spec's own explicit instruction ("quantity = total gross weight of selected shipments").
  Trusting the explicit written formula over what looks like an uncross-checked hand-typed demo
  number — implementing quantity = Σ gross weight (so it agrees with Section E's own total, as it
  should for a real, programmatically-generated form). Both name and quantity stay editable overrides.
- **Value — CORRECTED from my own first-pass reading of the prose spec.** The sample shows
  `€27,482.93`, which is exactly Section F's **Net FOB Export Value total**, not "order value +
  freight" (that would be ~95,000+, nowhere close). Net FOB = goods value *after* freight is
  removed — which is exactly what "value of goods collected from the supplier" should mean (freight
  is a cost added later, not part of what was paid at the source). Implemented as: Section D Value
  = Section F's Net FOB total (computed, not an independent editable field — it's the same number
  appearing twice on the form, a cross-check pattern common on these government forms).
Below: italic note (editable boilerplate): *"Note: A certificate from the Export Promotion Bureau /
concerned Association regarding the name, quantity, value and source of collection of the exported
goods must be submitted."*

**(E) DETAILS OF THE EXPORT CONSIGNMENT** — one row per member shipment. Columns: SL | Description
of Goods (= Export Category name, same every row) | Quantity (shipment's gross weight, KG) |
Invoice Value in Foreign Currency (= orderValueForeign + freightCost) | Date of Shipment | EXP No.
& Date (rendered as `{expNo}/{year}`, no separate date sub-field despite the header's "& Date" —
confirmed from every sample row, e.g. `000367/2026`) | Repatriated Export Value in Foreign Currency
& Date of Repatriation (rendered `{invoiceValue} / {ttDate DD.MM.YYYY}` — value is the SAME number
as Invoice Value, date is that shipment's latest TT entry date — this is the literal "Repatriated =
Invoice Value / TT Date" the original prose spec described, now visually confirmed). TOTAL row:
Σquantity, ΣInvoiceValue, blank, blank, ΣRepatriated (both money totals should agree with each other
when computed programmatically — the sample's own TOTAL row shows two DIFFERENT numbers for these,
63,317.25 vs 61,545.00, which is a hand-typed demo inconsistency, not a rule to replicate: it
exactly equals Section C's TT total, i.e. almost certainly a copy-paste slip in their sample. My
generator computes both totals for real from the same per-row data, so they'll always agree.)
Below: italic note (editable boilerplate): *"Note: Attested negotiable copies of the Export
Invoice, Packing List and Bill of Lading / Airway Bill, etc., together with the Proceeds
Realisation Certificate (PRC) for the export value, must be submitted."*

**(F) AMOUNT OF INCENTIVE APPLIED FOR** — one row per shipment, small numeric sub-header row "1 2
3 4 5" under the text headers (nice authentic touch, cheap to replicate — just a 2nd header row).
Columns: Airway Bill/BL No. | (1) Repatriated Export Value (FC) | (2) Freight, if applicable (FC)
| (3) Commission, Insurance, etc., if any (FC) | (4) Net FOB Export Value = (1)-(2+3) | (5)
Incentive Receivable = (4)×category.incentivePercentage/100. Verified against the sample's real
numbers row-by-row AND via the TOTAL row (61,545.00 − 34,062.07 = 27,482.93; ×10% = 2,748.29) —
formula is exactly confirmed, not a guess. Commission column is per-shipment "N/A" in the sample,
but Section 20 of the spec treats Commission/Insurance as ONE admin-editable value for the whole
application, not per-shipment — implementing it that way (one editable value+label, default
0/"N/A", shown as a single TOTAL-row-only figure rather than duplicated identically on every data
row, which is a reasonable, harmless layout simplification since the sample's own per-row values
are identical/N/A anyway).
Below: italic note (editable boilerplate): *"(Where freight is applicable, a certified copy of the
Freight Certificate mentioning the freight charge must be submitted.)"*

**(G) DECLARATION** — NEW, wasn't in the original prose spec at all. Exact text (editable, this
becomes DEFAULT_KA_FORM_TEXT.en.declaration): *"It is hereby declared that this application for
incentive is made against the export of wholly indigenous agricultural products (vegetables and
fruits). All information furnished in this application is completely correct. If it is
subsequently found that there is any error, falsehood, deception or forgery in this declaration,
the entire amount of incentive availed, or any part thereof, will be recovered from my/our bank
account."* Below it, two-column bottom row: left = `Date: ....... / ....... / ...............`
(blank — a physical-signing field, generated as literal dots, never filled programmatically);
right = signature line (horizontal rule) + `Signature and Designation of the Proprietor /
Authorized Officer of the Applicant's Organization`.

**(H) TO BE FILLED IN BY THE BANK BRANCH DISBURSING THE INCENTIVE** — NEW, also absent from the
prose spec. 4-column single-row table: Repatriated Export Value (FC) | Total Deduction for
Commission Paid Abroad, Insurance and Freight, if applicable (FC) [= Freight+Commission combined,
one column here vs. two separate ones in Section F] | Net FOB Export Value (FC) | Payable Incentive
Amount (in Taka...) rendered as `{incentiveReceivableFC} @ Tk. {rate}/{CCY} = Tk. {payableBDT}`.
Below: `Amount of Incentive Paid in Taka: ( ...same-dotted-blank... )` and `Date of Payment: ....../
....../ ...............` on one line (BOTH literal blanks — bank fills these in physically, never
populated by the generator) then a signature line: `Signature, Name and Designation of the
Authorized Bank Officer Approving the Incentive`. Legal citation footnote under the section title
isn't repeated here (it's only at the very top, per the rasterized page — see title block above).

**"Incentive after costing" (R20) is NOT part of the real Ka Form at all** — confirms the original
design call: it's Shah International's own internal net-take-home layer on top of the government
form's gross Payable Incentive Amount (H), shown as a separate summary block in the Incentive
Details tab, not printed as part of the Ka Form document itself.

**Numeral convention**: monetary values use South-Asian lakh-style grouping even in the ENGLISH
form (`5,00,000.00`, `Intl.NumberFormat('en-IN')`). The Bengali form (no sample available, but see
Bengali Stamp Application below for the established convention in this same document family) should
render ALL digits — dates, amounts, serials — in Bengali numerals (০-৯), a simple char-substitution
map applied at final render time for the bn language tab only.

## STAMP APPLICATION — full 3-page text, both languages (previously only had paragraph 1 of 5)

Layout: each of the 3 pages has substantial blank top margin before text starts (~35% of page
height) — designed for a letterhead/bank-header image, exactly like this app's existing Packing
List/Invoice PDF header treatment. Reusing that same letterhead mechanism (shipment's Export
License letterhead, falling back to the global company letterhead) at the top of each page.

### English (verbatim, my own {PLACEHOLDER} markers added — this becomes DEFAULT_STAMP_TEXT.en)

```
To,
The Deputy General Manager,
{BANK_NAME},
{BRANCH_NAME},
{BANK_ADDRESS}.

UNDERTAKING

I, {OWNER_NAME}, Proprietor, {LICENSE_NAME}, do hereby undertake that I have,
for a long time, been conducting the business of exporting {CATEGORY_NAME} in
the country and abroad under the name of the said firm. Against our export contract
No. {CONTRACT_NO}, dated {CONTRACT_DATE}, we have exported agricultural products (betel leaf,
{CATEGORY_NAME_LOWER}, and fruits) worth {CCY} {VALUE} against EXP Nos. {EXP_SEQUENCE},
through shipments dated {SHIPMENT_DATES}, and against the same, {CCY} {VALUE} has been repatriated to
Bangladesh. All information submitted in this regard is true and accurate. The
materials used in the exported goods have been purchased locally at cash value from
the market.

[PAGE BREAK]

We further undertake that all the information stated above is entirely true. All documents submitted
to the Bank are correct. No fraudulent means whatsoever have been resorted to. If any document
submitted is subsequently proven or found to be forged or false, appropriate action may be taken
against me/us under the prevailing law.

Being fully aware of the above, and without inducement or influence from anyone, I/we, on this
______ day of ____________, have signed this Undertaking and/or affixed my/our own name and
signature hereto.

                                                                                         Applicant

[PAGE BREAK]

I/We undertake that I/we have applied within the stipulated time following the repatriation of
my/our export proceeds, and that no export proceeds remain unrepatriated against the EXP forms
submitted. Furthermore, within the past 2 (two) years or more from the date of the application
submitted for the cash incentive, no other export bill of mine/ours remains unrepatriated, and no
amount exceeding or falling short of 5% (five percent) of the invoice value has been repatriated.
Furthermore, I/we have purchased the exported goods locally at cash value from the market.

If any information, declaration, export document, or matter relating to the calculation of the cash
incentive furnished by me/us is subsequently proven or found to be incorrect, I/we shall bear full
responsibility and liability for the same, and the Bank authority is hereby granted the right to adjust
the objected amount from my/our account should any audit objection be raised. However, if the
Bank authority is unable to adjust the objected amount owing to insufficiency of funds, I/we shall
deposit the said amount with the Bank from my/our own sources, and no objection whatsoever
shall be raised in this regard by me/us, or by any person or institution appointed or authorized by us,
or by our heirs; and should any such objection be raised, it shall be disregarded in all courts.
```
(NOTE: `{OWNER_NAME}`→ExportLicense.ownerName, `{LICENSE_NAME}`→ExportLicense.licenseName,
`{CATEGORY_NAME}`→ExportCategory.name, `{CONTRACT_NO}`/`{CONTRACT_DATE}`→ExportContract,
`{CCY} {VALUE}`→application's Section D/F Net-FOB-style total (both occurrences use the SAME
total — Section F/H's Repatriated total, i.e. Σ(orderValueForeign+freightCost), confirmed identical
in the sample: 61,545.00 appears both times), `{EXP_SEQUENCE}`/`{SHIPMENT_DATES}` per the
first-gets-year/middle-plain/last-gets-year rule below, `{BANK_NAME}`/`{BRANCH_NAME}`/
`{BANK_ADDRESS}`→first member shipment's bank fields.)

**EXP/date sequence rule** (confirmed against the sample verbatim): first EXP gets `-{year}`
suffix, middle ones are bare, last gets `-{year}` suffix again, comma-separated with "and" before
the last: `000367-2026, 000530, 000593, 000759, 000776, 000857, and 00142-2026`. Shipment dates:
plain comma list, "and" before last, `DD/MM/YYYY`: `25/01/2026, 02/02/2026, ..., and 14/04/2026`.
Ka Form's OWN date fields use dots (`DD.MM.YYYY`) — Stamp Application uses slashes (`DD/MM/YYYY`)
— replicating both conventions exactly as each document shows them.

### Bengali (verbatim — extracted via `pdftotext`, a REAL embedded Unicode font, not OCR — this is
### clean and authoritative, unlike the garbled version that appeared when first pasted into chat;
### using this directly instead of writing my own translation)

```
বরাবর,
ডেপুটি জেনারেল ম্যানেজার,
{BANK_NAME},
{BRANCH_NAME},
{BANK_ADDRESS}।

অঙ্গীকারনামা

{OWNER_NAME}, স্বত্বাধিকারী, {LICENSE_NAME} এই মর্মে অঙ্গীকার করিতেছি যে, আমি
দীর্ঘ দিন যাবত সুনামের সহিত কোম্পানীর পক্ষে {CATEGORY_NAME_BN} রপ্তানী ব্যবসা
পরিচালনা করে আসতেছি। আমাদের রপ্তানী চুক্তিপত্র নং {CONTRACT_NO}, তারিখ:-
{CONTRACT_DATE}ইং উক্ত চুক্তিপত্রের বিপরীতে আমরা {EXP_SEQUENCE_BN} নম্বর ইএক্সপি এর
অনুকূলে জাহাজীকরণের তারিখ:- {SHIPMENT_DATES_BN} ইং এর মাধ্যমে
{VALUE_BN} {CCY_BN} এর কৃষিপণ্য (পান, {CATEGORY_NAME_BN} ও ফলমূল) রপ্তানী করিয়াছি এবং
এর বিপরীতে {VALUE_BN} {CCY_BN} বাংলাদেশে প্রত্যাবাসিত হইয়াছে। এ বিষয়ে যে সব
তথ্য পেশ করিয়াছি তা সত্য ও নির্ভুল। রপ্তানীকৃত পণ্যের ব্যবহৃত উপকরণ স্থানীয়ভাবে
নগদ মূল্যে বাজার থেকে ক্রয় করিয়াছি।

[PAGE BREAK]

এ ছাড়া ও আরো অঙ্গীকার করিতেছি যে, উপরে বর্ণিত সকল তথ্যাদি সম্পূর্ণ সত্য। ব্যাংকে সরবরাহকৃত
সকল দলিলাদি সঠিক। কোন প্রকার জাল-জালিয়াতির আশ্রয় গ্রহন করা হয় নাই। দাখিলকৃত যেকোন
দলিলাদি যদি ভবিষ্যতে জাল/অসত্য প্রমানিত হয় তবে দেশের প্রচলিত আইনে আমার/আমাদের
বিরুদ্ধে যে কোন ব্যবস্থা গ্রহন করা যাইবে।

এতদ বিষয়ে সম্যক অবগত হইয়া এবং কাহারো বিনা প্ররোচনায় আমি/আমরা অদ্য.......... তারিখে নিজ
নাম লিখিয়া/সহি অংকন করিয়া দিলাম।

                                                                                    নিবেদক

[PAGE BREAK]

আমি/আমরা অঙ্গীকার করিতেছি যে, আমার/আমাদের রপ্তানীমূল্য প্রত্যাবাসিত হওয়ার পর নির্ধারিত
সময়ের মধ্যেই আবেদন করিয়াছি এবং দাখিলকৃত ইএক্সপি সমূহের বিপরীতে কোন রপ্তানীমূল্য
অপ্রত্যাবাসিত নাই। তাছাড়া নগদ সহায়তা প্রাপ্তির জন্য দাখিলকৃত উক্ত আবেদন পত্রের তারিখ হইতে
বিগত ২ (দুই) বৎসর বা ততোধিক সময়ের মধ্যে আমার অন্য কোন রপ্তানী বিল অপ্রত্যাবাসিত নাই এবং
ইনভয়েজ মূল্যের ৫ (পাঁচ)% এর বেশী অথবা কম মূল্য প্রত্যাবাসিত হয় নাই। তাছাড়া আমি/আমরা
রপ্তানীকৃত পণ্য স্থানীয়ভাবে নগদমূল্যে বাজার থেকে ক্রয় করিয়াছি।

আমার/আমাদের প্রদত্ত কোন তথ্যাদি/ঘোষনা/রপ্তানী ডকুমেন্টস কিংবা নগদ সহায়তা হিসাবায়নে যদি
পরবর্তীতে ভুল প্রমানিত/উদ্‌ঘাটিত হয় তাহা হইলে আমি/আমরা উক্ত কাজের সকল দায় দায়িত্ব বহন
করিব এবং যে কোন ধরনের নিরীক্ষা আপত্তি উত্থাপিত হলে ব্যাংক কর্তৃপক্ষকে আমার/আমাদের হিসাব
হইতে আপত্তি পরিমান অর্থ সমন্বয় করার অধিকার প্রদান করা হইলো। তবে তহবিল অপর্যাপ্ততার কারনে
ব্যাংক কর্তৃপক্ষ আপত্তিকৃত অর্থ সমন্বয় করিতে ব্যর্থ হইলে আমি/আমরা উক্ত পরিমান অর্থ
আমার/আমাদের নিজস্ব উৎস হইতে ব্যাংকে জমা প্রদান করিবো এবং এ বিষয়ে আমি/আমরা অথবা
আমাদের কর্তৃক নিয়োজিত/ক্ষমতাপ্রাপ্ত কোন ব্যক্তি/প্রতিষ্ঠান অথবা আমাদের ওয়ারিশগন হইতে
কোনরূপ ওজর আপত্তি উত্থাপন করা হইবেনা, যদি উত্থাপিত হয় তবে তাহা সর্ব আদালতে অগ্রাহ্য হইবে।
```
(`নিবেদক` = "Applicant"/"Petitioner" — the Bengali signature-line label. Original PDF sample used
raw Arabic-numeral placeholders even in the Bengali text for some figures — e.g. contract no
rendered as "এস, আই/০০১" (a slightly awkward direct transliteration of "SI/001") — implementing
{CONTRACT_NO} verbatim as stored (usually Latin alphanumeric, contract numbers aren't typically
translated) rather than trying to transliterate it, and using proper Bengali numerals (০-৯) for
all pure numeric fields — dates, EXP sequence, amounts — via a simple digit-substitution map,
matching how the rest of the Bengali sample document renders numbers.)

## Formula confirmation (cross-checked against the real sample's numbers, not just prose)

- `netFobFC = ΣinvoiceValueFC(shipments) − (ΣfreightFC + commissionInsuranceFC)`
  → sample: 61,545.00 − (34,062.07 + 0) = 27,482.93 ✓ (exact match, both per-row and in total)
- `incentiveReceivableFC = netFobFC × category.incentivePercentage/100`
  → sample: 27,482.93 × 10% = 2,748.293 ≈ 2,748.29 ✓
- `payableIncentiveBDT = incentiveReceivableFC × effectiveRateBDT`
  → sample: 2,748.293 × 144.50 ≈ 397,127 ✓ (matches to the Taka, small rounding in their demo)
- Section D "Value" = netFobFC (same total as Section F), not "order value + freight" as an
  isolated first-pass reading of the prose spec suggested — corrected above.
This is the exact formula already written into AGENT_PROGRESS_9.md's Key Design Decision #4 — no
change needed there, this is independent confirmation from real numbers, not a revision.
