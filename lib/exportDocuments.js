import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getDocumentColumns, columnHeaderLabel } from './exportColumns';
import { loadImageForPdf, drawLetterheadBackground } from './pdfLetterhead';

// Real, byte-exact PDF generation for the 3 export-shipment documents (Packing List, Buyer's
// Commercial Invoice, BD Invoice). This is the single source of truth for the "Download PDF"
// action (issue 35) and for the Archive's generated-document files (issue 38) — since the PDF is built
// from the shipment's data directly, it can NEVER contain any website UI/sidebar/nav, unlike a
// print-the-page screenshot approach would risk.
//
// Mirrors the layout of the print view (see app/(print)/print/export/[shipmentId]/page.jsx) so the
// printed copy and the downloaded copy look the same, just produced by two different renderers.

// Fallback only — used when a caller doesn't pass exporterInfo (e.g. an older call site, or the
// bulk "all documents" merge). Matches Settings' own exporterName/exporterAddress schema defaults
// exactly, so omitting exporterInfo is a no-op, not a regression.
const DEFAULT_EXPORTER = { exporterName: 'Shah International', exporterAddress: '111 South Bashabo, Opposite of Sabujbagh Thana, Dhaka 1214' };

// Batch 8 (R5) — the exact hardcoded strings an admin can now override per-shipment, per-document
// (via documentTextOverrides on ExportShipment). Kept here as the single source of truth so the
// Edit modal, the print route, and every generator below all agree on what "the default" is.
export const DEFAULT_DOCUMENT_TEXT = {
  packingList: {
    declaration: '1. We hereby certify that the information on this invoice is true and correct and that contents of this shipment are as state above.',
    signatoryTitle: 'Proprietor',
  },
  buyerInvoice: {
    // {REX} is substituted with the shipment's own REX No at generation time — kept as a token here
    // (rather than baked into a per-shipment override) so an admin editing this text doesn't have to
    // re-type the whole paragraph just to see a different REX No; if they delete the token outright
    // that's respected too (their override wins verbatim, same as any other field override).
    declaration: 'THE EXPORTER {EXPORTER_NAME}. BDREX{REX} OF THE PRODUCTS COVERED BY THIS DOCUMENTS DECLARES THAT, EXCEPT WHERE OTHERWISE CLEARLY INDICATED. THESE PRODUCTS ARE OF BANGLADESH PREFERENTIAL ORIGIN (5) ACCORDING TO RULES OF THE GENERALIZED SYSTEM OF PREFERENCES OF THE EUROPEAN UNION AND THAT THE ORIGIN CRITERION MET IS W 0709,0714,0710, 0810 (07119000)1. We hereby certify that the information on this invoice is true and correct and that contents of this shipment are as state above.',
    signatoryTitle: 'Proprietor',
  },
  bdInvoice: {
    declaration: '1. We hereby certify that the information on this invoice is true and correct and that contents of this shipment are as state above.',
    signatoryTitle: 'Proprietor',
  },
};

// Resolves the admin's own override (if any) over the default above, and fills in the {EXPORTER_NAME}/
// {REX} tokens for the buyer-invoice declaration either way.
export function resolveDocumentText(docKey, shipment, exporterInfo) {
  const override = shipment?.documentTextOverrides?.[docKey] || {};
  const base = DEFAULT_DOCUMENT_TEXT[docKey];
  const declaration = (override.declaration || base.declaration)
    .replace('{EXPORTER_NAME}', (exporterInfo.exporterName || 'SHAH INTERNATIONAL').toUpperCase())
    .replace('{REX}', shipment?.rexNo || '');
  const signatoryTitle = override.signatoryTitle || base.signatoryTitle;
  return { declaration, signatoryTitle };
}

const PAGE_WIDTH = 210; // A4, mm
const PAGE_HEIGHT = 297;
const MARGIN = 12;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
// Batch 17 (R5): a safe top clearance for whenever NO letterhead image gets drawn — either Plain
// A4 was explicitly chosen, or letterhead mode was requested but nothing is configured/loadable
// for this shipment. These documents are meant to be printed directly onto (or laid over) paper
// that may already have a physical company letterhead pre-printed on it; the ordinary page MARGIN
// (12mm) isn't enough clearance for that, and content can visually overlap it. 1 inch (25.4mm) is
// a safe, standard clearance for a typical pre-printed letterhead header band.
const PLAIN_TOP_MARGIN = 25.4;

// Issue 9 (R24): the uploaded company letterhead IS the header now — logo, company name, address,
// phone, email, website, banner, all of it lives only in that one uploaded image. No header is ever
// synthesized in code any more (the old "coded banner fallback" — a green rect + drawn company name/
// address — has been removed entirely, not just deprioritized). `plain` mode (no letterhead) simply
// starts content at PLAIN_TOP_MARGIN with no header graphic at all. See lib/pdfLetterhead.js for
// the shared full-page-background placement logic every document in this app now uses identically.
function drawHeader(doc, y, letterhead, exporterInfo, plain) {
  const contentStartY = plain ? null : drawLetterheadBackground(doc, letterhead, PAGE_WIDTH, PAGE_HEIGHT);
  // Batch 17 (R5): contentStartY is null in BOTH the plain-mode case above AND whenever letterhead
  // mode was requested but drawLetterheadBackground had no actual image to draw (see
  // lib/pdfLetterhead.js) — either way, nothing was drawn, so use the safe 1" clearance instead of
  // just falling back to the ordinary page MARGIN.
  return contentStartY != null ? contentStartY : PLAIN_TOP_MARGIN;
}

function drawTitle(doc, y, title) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
  doc.text(title, PAGE_WIDTH / 2, y, { align: 'center' });
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 3, PAGE_WIDTH - MARGIN, y + 3);
  return y + 9;
}

// rows: array of [label, value] pairs, laid out 2-per-line like the reference documents' 2-column
// layout. Wrapped in a thin black border to read as one cohesive document block, matching the
// reference PDFs rather than the previous borderless/floating text.
function drawInfoGrid(doc, y, rows) {
  const startY = y;
  doc.setFontSize(8.5);
  let cursorY = y + 4;
  for (let i = 0; i < rows.length; i += 2) {
    const leftX = MARGIN + 2, rightX = MARGIN + CONTENT_WIDTH / 2 + 4;
    const pair = [rows[i], rows[i + 1]];
    const colWidth = CONTENT_WIDTH / 2 - 6;
    pair.forEach(([label, val], idx) => {
      if (!label) return;
      const x = idx === 0 ? leftX : rightX;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text(`${label}:`, x, cursorY);
      const labelW = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'normal');
      doc.text(String(val || ''), x + labelW, cursorY, { maxWidth: colWidth - labelW });
    });
    cursorY += 5;
  }
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
  doc.rect(MARGIN, startY, CONTENT_WIDTH, cursorY - startY + 2);
  doc.line(PAGE_WIDTH / 2 + 1, startY, PAGE_WIDTH / 2 + 1, cursorY + 2);
  return cursorY + 5;
}

// Dedicated 3-column table for EXP No / AWB / PC — each has its own identifier value AND its own
// date (expDate/awbDate/pcDate — see the shipment editor), matching the reference document's exact
// layout: Label | Value | Date, a vertical rule between every column, date right-aligned. Previously
// these were inline "value DT:date" text within InfoGrid's own [label, value] cells — this replaces
// that with a real 3-column layout matching the reference precisely, since InfoGrid's 2-per-row
// single-line-per-cell design has no way to express a 3rd column with its own alignment rule; rather
// than bolt a special case onto that shared function, this is deliberately separate.
// TABLE_W matches drawInfoGrid's own left-column boundary EXACTLY (PAGE_WIDTH/2 + 1, the same x
// its center divider is drawn at — see drawInfoGrid above) rather than the full CONTENT_WIDTH: this
// table is always drawn directly under TIN/BIN/ERC, which live in that same left column, so it
// needs to stop at that identical boundary. Using the full width made it visibly wider than every
// row above it — the table's own right edge cut across where "Final Destination" and the rest of
// the right column sit, instead of stopping level with the rest of the left column.
function drawIdentifierTable(doc, y, rows) {
  const startY = y;
  const TABLE_W = CONTENT_WIDTH / 2 + 1;
  const labelW = TABLE_W * 0.17;
  const valueW = TABLE_W * 0.51;
  const dateW = TABLE_W * 0.32;
  const rowH = 6;
  doc.setFontSize(8.5);
  rows.forEach(([label, value, date], i) => {
    const rowY = startY + i * rowH;
    const textY = rowY + rowH / 2 + 1.2;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text(label, MARGIN + 2, textY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value || ''), MARGIN + labelW + 2, textY, { maxWidth: valueW - 4 });
    doc.text(String(date || ''), MARGIN + labelW + valueW + dateW - 2, textY, { align: 'right' });
  });
  const totalH = rows.length * rowH;
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
  doc.rect(MARGIN, startY, TABLE_W, totalH);
  doc.line(MARGIN + labelW, startY, MARGIN + labelW, startY + totalH);
  doc.line(MARGIN + labelW + valueW, startY, MARGIN + labelW + valueW, startY + totalH);
  doc.setLineWidth(0.15);
  for (let i = 1; i < rows.length; i++) {
    const lineY = startY + i * rowH;
    doc.line(MARGIN, lineY, MARGIN + TABLE_W, lineY);
  }
  return startY + totalH + 5;
}

function drawBankLine(doc, y, shipment) {
  if (!shipment.beneficiaryBank) return y;
  const lines = [
    `Beneficiary Bank: ${shipment.beneficiaryBank}`,
    `Account Number: ${shipment.accountNo || ''}`,
    shipment.branchName || '',
    shipment.bankAddress || '',
    `Routing Number: ${shipment.routingNo || ''}`,
    `Swift Code: ${shipment.swiftCode || ''}`,
  ].filter(Boolean);
  const h = lines.length * 3.6 + 4;
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
  doc.rect(MARGIN, y, CONTENT_WIDTH, h);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
  lines.forEach((line, i) => doc.text(line, MARGIN + 2, y + 4 + i * 3.6, { maxWidth: CONTENT_WIDTH - 4 }));
  return y + h + 4;
}

// drawSignature (the "line + Proprietor + company name" block) was removed in R25 (issue 2) — no
// signature/stamp is drawn in the generated file at all any more; a physical company stamp is added
// by hand afterward, which is exactly what that drawn block used to stand in for.

// Same rendering logic as the admin editor's ReadOnlyItemsView / the print page's renderItemCell —
// jsPDF's autoTable needs plain strings, not JSX, but reads the identical column keys/order from
// lib/exportColumns.js so a downloaded PDF never disagrees with the on-screen preview.
function cellText(key, item, currency) {
  switch (key) {
    case 'hsCode': return item.hsCode || '';
    case 'packSizeKg': return item.ctnSizeKg ? String(item.ctnSizeKg) : '';
    case 'totalCTN': return item.totalCTN ? String(item.totalCTN) : '';
    case 'quantityKg': return item.quantityKg ? Number(item.quantityKg).toFixed(1) : '';
    case 'unitPrice': return item.unitPrice ? Number(item.unitPrice).toFixed(2) : '';
    case 'averagePrice': {
      const q = Number(item.quantityKg) || 0;
      return q > 0 ? (Number(item.totalValue || 0) / q).toFixed(2) : '';
    }
    case 'totalValue': return `${Number(item.totalValue || 0).toFixed(2)} ${currency}`;
    default: return '';
  }
}
function grandCellText(key, grand, currency) {
  switch (key) {
    case 'totalCTN': return String(grand.totalCTN);
    case 'quantityKg': return grand.quantityKg.toFixed(1);
    case 'averagePrice': return grand.quantityKg ? (grand.totalValue / grand.quantityKg).toFixed(2) : '';
    case 'totalValue': return `${grand.totalValue.toFixed(2)} ${currency}`;
    default: return '';
  }
}
function grandTotals(items) {
  return {
    totalCTN: items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0),
    quantityKg: items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0),
    totalValue: items.reduce((a, r) => a + (Number(r.totalValue) || 0), 0),
  };
}
// Plain black-border table styling, no fill colors anywhere — matches the reference PDFs, replaces
// the previous dark header / colored footer / zebra-striped body.
// fillColor: false (not [255,255,255]/white) on every level below — head, body, foot, alternate
// rows, AND the table-wide base — is deliberate: a letterhead image can legitimately render taller
// than the fixed content-start offset (LETTERHEAD_CONTENT_START_MM in lib/pdfLetterhead.js), in
// which case this table's own rows visually overlap the still-visible lower part of that image.
// jsPDF draws sequentially like a canvas (the letterhead is drawn first, this table after) — an
// OPAQUE fill here would paint a solid rectangle over whatever's underneath on every single cell,
// hiding that part of the letterhead entirely. `false` skips the fill draw call altogether, leaving
// the letterhead visible through the whole table wherever it extends into it — only the text and
// the grid lines below (lineColor/lineWidth, a separate property from fillColor) are ever drawn on
// top of it. bodyStyles/the table-wide `styles` block never had an explicit fillColor before, which
// left them on the 'grid' theme's own default (opaque white) — that gap, not just the headStyles/
// footStyles/alternateRowStyles values, was as much a part of "content covers the watermark" as
// the openly-white ones were.
const PLAIN_TABLE_STYLE = {
  theme: 'grid',
  styles: { cellPadding: 1.5, fillColor: false, halign: 'center' },
  headStyles: { fillColor: false, textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2, fontSize: 8, halign: 'center' },
  footStyles: { fillColor: false, textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2, fontSize: 8, halign: 'center' },
  bodyStyles: { fillColor: false, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.15, fontSize: 8, halign: 'center' },
  alternateRowStyles: { fillColor: false },
  margin: { left: MARGIN, right: MARGIN },
};

export async function generatePackingListPDF({ shipment, buyer, letterheadUrl, exporterInfo = DEFAULT_EXPORTER, plain = false }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const letterhead = plain ? null : await loadImageForPdf(letterheadUrl);
  let y = MARGIN;
  y = drawHeader(doc, y, letterhead, exporterInfo, plain);
  y = drawTitle(doc, y, 'Packing List');

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
  y = drawInfoGrid(doc, y, [
    ['Exporter', `${exporterInfo.exporterName}, ${exporterInfo.exporterAddress}`], ['Country Of Origin', shipment.countryOfOrigin || 'Bangladesh'],
    ['Contract No', shipment.contractNo], ['Sales Term', shipment.salesTerm],
    ['Invoice No', `${shipment.invoiceNo || ''}${shipment.date ? ` DT:${fmtDate(shipment.date)}` : ''}`], ['Importer', `${buyer?.name || ''}, ${buyer?.address || ''}`],
    ['TIN', shipment.tinNo], ['Mode of Carrying', shipment.modeOfCarrying],
    ['BIN', shipment.binNo], ['Landing Port', shipment.landingPort],
    ['ERC', shipment.ercNo], ['Port Of Discharge', shipment.portOfDischarge],
    [null, null], ['Final Destination', shipment.finalDestination],
  ]);
  y = drawIdentifierTable(doc, y, [
    ['EXP No', shipment.expNo, fmtDate(shipment.expDate)],
    ['AWB', shipment.awbNo, fmtDate(shipment.awbDate)],
    ['PC', shipment.pcNo, fmtDate(shipment.pcDate)],
  ]);

  y = drawBankLine(doc, y, shipment);

  const items = (shipment.items || []).filter((i) => i.productName);
  const grand = grandTotals(items);
  const currency = shipment.baseCurrency || 'EUR';
  const columns = getDocumentColumns(shipment.exportCategory, 'packingList');

  autoTable(doc, {
    startY: y,
    head: [['SL NO.', 'Name of Products (Botanical Name)', ...columns.map((k) => columnHeaderLabel(k, currency, shipment.salesTerm))]],
    body: items.map((item, i) => [
      i + 1,
      item.botanicalName ? `${item.productName} (${item.botanicalName})` : item.productName,
      ...columns.map((k) => cellText(k, item, currency)),
    ]),
    foot: [['', 'Grand Total :', ...columns.map((k) => grandCellText(k, grand, currency))]],
    // Issue 9: a packing list with enough items to spill onto page 2+ still needs the letterhead
    // background on every one of those pages, not just the first (autoTable draws pages 2+ itself
    // during its own pagination, after this call already returns, so it needs its own hook here).
    didDrawPage: (data) => { if (!plain && data.pageNumber > 1) drawLetterheadBackground(doc, letterhead, PAGE_WIDTH, PAGE_HEIGHT); },
    ...PLAIN_TABLE_STYLE,
  });
  y = doc.lastAutoTable.finalY + 4;

  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 7);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
  doc.text(`Gross Weight : ${shipment.totalGrossWeightKg || ''} KG    Freight Cost : ${shipment.freightCost || ''} ${currency}`, MARGIN + 2, y + 4.5);
  y += 11;

  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  const { declaration: packingDeclaration, signatoryTitle: packingSignatory } = resolveDocumentText('packingList', shipment, exporterInfo);
  const certLines = doc.splitTextToSize(packingDeclaration, CONTENT_WIDTH - 4);
  const boxTop = y;
  doc.text(certLines, MARGIN + 2, y + 4);
  // Was `certLines.length * 3.5 + 3` — missing the same `+4` used just above to POSITION the text
  // (the declaration is drawn at y+4, but the running y tracker never accounted for that initial
  // offset before advancing past it), so the next line ended up LESS than one line-height below the
  // declaration's own baseline — reading as the two lines almost touching, no visible paragraph gap
  // at all. +4 restores the offset the draw call already used; +3 (not the previous bare +3 with no
  // offset) is the actual intended breathing room on top of that.
  y += 4 + certLines.length * 3.5 + 3;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Carton: ${grand.totalCTN} CTN`, MARGIN + 2, y); y += 4;
  doc.text(`Net Weight: ${shipment.totalNetWeightKg || ''} KG`, MARGIN + 2, y); y += 4;
  doc.text(`Gross Weight: ${shipment.totalGrossWeightKg || ''} KG`, MARGIN + 2, y);
  doc.rect(MARGIN, boxTop, CONTENT_WIDTH, y - boxTop + 4);
  y += 8;

  // Issue 2 (R25): no signature/stamp block in the generated file at all any more — a physical
  // company stamp is added by hand afterward, and the old drawn "signature line + Proprietor +
  // company name" was exactly what that stamp is meant to replace. `packingSignatory` (still
  // resolved above) is intentionally unused here now — kept available in case a future format needs
  // it, but nothing in this function renders it.
  return doc;
}

// R3/R4: Buyer's Invoice and BD Invoice share this generator (both headed "Commercial Invoice") but
// differ in item source, column set, H.S. Code placement, and declaration text — see the matching
// comment on InvoiceDoc in the print page for the full reasoning.
export async function generateInvoicePDF({ shipment, buyer, letterheadUrl, type, exporterInfo = DEFAULT_EXPORTER, plain = false }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const letterhead = plain ? null : await loadImageForPdf(letterheadUrl);
  const isBuyer = type === 'buyer-invoice';
  const currency = shipment.baseCurrency || 'EUR';
  const items = (isBuyer ? shipment.items : shipment.bdItems || []).filter((i) => i.productName);
  const columns = getDocumentColumns(shipment.exportCategory, isBuyer ? 'buyerInvoice' : 'bdInvoice');

  let y = MARGIN;
  y = drawHeader(doc, y, letterhead, exporterInfo, plain);
  y = drawTitle(doc, y, 'Commercial Invoice');

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
  y = drawInfoGrid(doc, y, [
    ['Exporter', `${exporterInfo.exporterName}, ${exporterInfo.exporterAddress}`], ['Country Of Origin', shipment.countryOfOrigin || 'Bangladesh'],
    ['Contract No', shipment.contractNo], ['Sales Term', shipment.salesTerm],
    ['Invoice No', `${shipment.invoiceNo || ''}${shipment.date ? ` DT:${fmtDate(shipment.date)}` : ''}`], ['Importer', `${buyer?.name || ''}, ${buyer?.address || ''}`],
    ['TIN', shipment.tinNo], ['Mode of Carrying', shipment.modeOfCarrying],
    ['BIN', shipment.binNo], ['Landing Port', shipment.landingPort],
    ['ERC', shipment.ercNo], ['Port Of Discharge', shipment.portOfDischarge],
    [null, null], ['Final Destination', shipment.finalDestination],
  ]);
  y = drawIdentifierTable(doc, y, [
    ['EXP', shipment.expNo, fmtDate(shipment.expDate)],
    ['AWB', shipment.awbNo, fmtDate(shipment.awbDate)],
    ['PC', shipment.pcNo, fmtDate(shipment.pcDate)],
  ]);

  y = drawBankLine(doc, y, shipment);

  const grand = grandTotals(items);

  autoTable(doc, {
    startY: y,
    // batch 17 (R3): BD Invoice rows are product-category names now, not individual products — no
    // botanical name applies there (only Buyer's Invoice still shows one). HS Code used to be
    // concatenated into this same cell for BD Invoice; it's a normal column now (via `columns`
    // above), rendered generically by cellText() in the same map as every other column.
    head: [['SL', isBuyer ? 'Name of Products (Botanical Name)' : 'Name of Products', ...columns.map((k) => columnHeaderLabel(k, currency, shipment.salesTerm))]],
    body: items.map((item, i) => {
      const name = isBuyer && item.botanicalName ? `${item.productName} (${item.botanicalName})` : item.productName;
      return [i + 1, name, ...columns.map((k) => cellText(k, item, currency))];
    }),
    foot: [['', 'Grand Total :', ...columns.map((k) => grandCellText(k, grand, currency))]],
    didDrawPage: (data) => { if (!plain && data.pageNumber > 1) drawLetterheadBackground(doc, letterhead, PAGE_WIDTH, PAGE_HEIGHT); },
    ...PLAIN_TABLE_STYLE,
  });
  y = doc.lastAutoTable.finalY + 4;

  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 7);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0, 0, 0);
  doc.text(`Gross Weight : ${shipment.totalGrossWeightKg || ''} KG    Freight Cost : ${shipment.freightCost || ''} ${currency}`, MARGIN + 2, y + 4.5);
  y += 11;

  // R3/R4: declaration differs by document — Buyer's Invoice gets the full BDREX/GSP paragraph
  // (with the shipment's real REX No interpolated, not a hardcoded placeholder); BD Invoice gets
  // the SAME simple declaration as Packing List. Batch 8 (R5): either can be overridden per-shipment.
  doc.setFont('helvetica', 'normal'); doc.setFontSize(isBuyer ? 6.8 : 7.5);
  const { declaration: declarationText, signatoryTitle: invoiceSignatory } = resolveDocumentText(isBuyer ? 'buyerInvoice' : 'bdInvoice', shipment, exporterInfo);
  const certLines = doc.splitTextToSize(declarationText, CONTENT_WIDTH - 4);
  const boxTop = y;
  doc.text(certLines, MARGIN + 2, y + 4);
  // Same fix as generatePackingListPDF above (was missing the +4 baseline offset that the draw call
  // just used, collapsing the gap before "Total Carton" to almost nothing) — see that function's
  // comment for the full explanation.
  y += 4 + certLines.length * (isBuyer ? 3.0 : 3.5) + 3;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text(`Total Carton: ${grand.totalCTN} CTN`, MARGIN + 2, y); y += 4;
  doc.text(`Net Weight: ${shipment.totalNetWeightKg || ''} KG`, MARGIN + 2, y); y += 4;
  doc.text(`Gross Weight: ${shipment.totalGrossWeightKg || ''} KG`, MARGIN + 2, y);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
  doc.rect(MARGIN, boxTop, CONTENT_WIDTH, y - boxTop + 4);
  y += 8;

  // Issue 2 (R25) — see the identical comment in generatePackingListPDF above.
  return doc;
}

// Single entry point mirroring the print route's docType convention (e.g. "packing-letterhead",
// "buyer-invoice-plain") so both Print and Download stay driven by the exact same doc-type strings.
export async function generateShipmentDocPDF({ docType, shipment, buyer, letterheadUrl, exporterInfo = DEFAULT_EXPORTER }) {
  const withLetterhead = docType.includes('letterhead');
  const baseType = docType.replace('-letterhead', '').replace('-plain', '');
  const effectiveLetterhead = withLetterhead ? letterheadUrl : '';
  if (baseType === 'packing') return generatePackingListPDF({ shipment, buyer, letterheadUrl: effectiveLetterhead, exporterInfo, plain: !withLetterhead });
  return generateInvoicePDF({ shipment, buyer, letterheadUrl: effectiveLetterhead, type: baseType, exporterInfo, plain: !withLetterhead });
}

export function docTypeLabel(baseType) {
  if (baseType === 'packing') return 'Packing List';
  if (baseType === 'buyer-invoice') return "Buyer's Invoice";
  if (baseType === 'bd-invoice') return 'BD Invoice';
  return baseType;
}

// Batch 8 (R5) — shared data assembly for the DOCX and XLSX generators below, so both agree on
// exactly the same info-grid rows, item columns, and totals the PDF/print views already use. Not
// used by the PDF path itself (which has its own tighter, layout-specific version of this) since
// jsPDF's drawInfoGrid needs a flat pair-list rather than this labeled-array shape.
function assembleDocData(docType, shipment, buyer, exporterInfo) {
  const baseType = docType.replace('-letterhead', '').replace('-plain', '');
  const isPacking = baseType === 'packing';
  const isBuyer = baseType === 'buyer-invoice';
  const docKey = isPacking ? 'packingList' : isBuyer ? 'buyerInvoice' : 'bdInvoice';
  const currency = shipment.baseCurrency || 'EUR';
  const items = ((isPacking || isBuyer) ? shipment.items : (shipment.bdItems || [])).filter((i) => i.productName);
  const columns = getDocumentColumns(shipment.exportCategory, docKey);
  const grand = grandTotals(items);
  const { declaration, signatoryTitle } = resolveDocumentText(docKey, shipment, exporterInfo);
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
  const infoPairs = [
    ['Exporter', `${exporterInfo.exporterName}, ${exporterInfo.exporterAddress}`], ['Country Of Origin', shipment.countryOfOrigin || 'Bangladesh'],
    ['Contract No', shipment.contractNo || ''], ['Sales Term', shipment.salesTerm || ''],
    ['Invoice No', `${shipment.invoiceNo || ''}${shipment.date ? ` DT:${fmtDate(shipment.date)}` : ''}`], ['Importer', `${buyer?.name || ''}, ${buyer?.address || ''}`],
    ['TIN', shipment.tinNo || ''], ['Mode of Carrying', shipment.modeOfCarrying || ''],
    ['BIN', shipment.binNo || ''], ['Landing Port', shipment.landingPort || ''],
    ['ERC', shipment.ercNo || ''], ['Port Of Discharge', shipment.portOfDischarge || ''],
    ['EXP No', `${shipment.expNo || ''}${shipment.expDate ? ` DT:${fmtDate(shipment.expDate)}` : ''}`], ['Final Destination', shipment.finalDestination || ''],
    ['AWB', `${shipment.awbNo || ''}${shipment.awbDate ? ` DT:${fmtDate(shipment.awbDate)}` : ''}`], ['PC', `${shipment.pcNo || ''}${shipment.pcDate ? ` DT:${fmtDate(shipment.pcDate)}` : ''}`],
  ];
  const bankLines = shipment.beneficiaryBank ? [
    `Beneficiary Bank: ${shipment.beneficiaryBank}`, `Account Number: ${shipment.accountNo || ''}`,
    shipment.branchName || '', shipment.bankAddress || '', `Routing Number: ${shipment.routingNo || ''}`, `Swift Code: ${shipment.swiftCode || ''}`,
  ].filter(Boolean) : [];
  // batch 17 (R3): BD Invoice rows are product-category names now, not individual products — no
  // botanical name applies there (Packing List and Buyer's Invoice still show one). HS Code used
  // to be appended into this same name text for BD Invoice; it's a normal column now (via
  // `columns` above), rendered generically by cellText() in the same map as every other column.
  const showBotanicalName = isPacking || isBuyer;
  const itemHead = ['SL', showBotanicalName ? 'Name of Products (Botanical Name)' : 'Name of Products', ...columns.map((k) => columnHeaderLabel(k, currency, shipment.salesTerm))];
  const itemRows = items.map((item, i) => {
    const name = showBotanicalName && item.botanicalName ? `${item.productName} (${item.botanicalName})` : item.productName;
    return [i + 1, name, ...columns.map((k) => cellText(k, item, currency))];
  });
  const footRow = ['', 'Grand Total', ...columns.map((k) => grandCellText(k, grand, currency))];
  const title = isPacking ? 'Packing List' : 'Commercial Invoice';
  return { baseType, title, currency, infoPairs, bankLines, itemHead, itemRows, footRow, grand, declaration, signatoryTitle };
}

// Triggers a browser download for an already-built Blob — same ObjectURL + programmatic-click
// pattern already used elsewhere in this codebase for the merged "All Documents" PDF.
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Batch 8 (R5) — Word version of the same 3 documents. Word/Excel aren't page-layout formats the
// way PDF is, so rather than trying to pixel-match the letterhead-banner PDF layout, this (and the
// XLSX generator below) render the same underlying data as a clean, native, directly-editable
// document — exactly what an admin reaching for "download as DOCX" actually wants: something they
// can tweak further in Word itself, not a locked-down replica of the PDF.
export async function generateShipmentDocDOCX({ docType, shipment, buyer, exporterInfo = DEFAULT_EXPORTER, filename }) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType } = await import('docx');
  const { title, currency, infoPairs, bankLines, itemHead, itemRows, footRow, grand, declaration, signatoryTitle } = assembleDocData(docType, shipment, buyer, exporterInfo);

  const cellP = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold, italics: !!opts.italics, size: opts.size || 18 })] });
  const infoRows = [];
  for (let i = 0; i < infoPairs.length; i += 2) {
    const [l1, v1] = infoPairs[i]; const [l2, v2] = infoPairs[i + 1] || [];
    infoRows.push(new TableRow({ children: [
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [cellP(l1, { bold: true })] }),
      new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [cellP(v1)] }),
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [cellP(l2 || '', { bold: true })] }),
      new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [cellP(v2 || '')] }),
    ] }));
  }
  const headerRow = new TableRow({ children: itemHead.map((h) => new TableCell({ shading: { fill: 'EEEEEE' }, children: [cellP(h, { bold: true })] })) });
  const bodyRows = itemRows.map((row) => new TableRow({ children: row.map((v) => new TableCell({ children: [cellP(v)] })) }));
  const footTableRow = new TableRow({ children: footRow.map((v) => new TableCell({ children: [cellP(v, { bold: true })] })) });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun({ text: exporterInfo.exporterName || 'Shah International', bold: true, size: 32 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: exporterInfo.exporterAddress || '', italics: true, size: 18 })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: title, bold: true })] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: infoRows }),
        new Paragraph({ text: '', spacing: { after: 150 } }),
        ...(bankLines.length ? [new Paragraph({ spacing: { after: 150 }, children: [new TextRun({ text: bankLines.join('  ·  '), size: 18 })] })] : []),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows, footTableRow] }),
        new Paragraph({ text: '', spacing: { after: 150 } }),
        new Paragraph({ spacing: { after: 150 }, children: [new TextRun({ text: `Gross Weight: ${shipment.totalGrossWeightKg || ''} KG   Freight Cost: ${shipment.freightCost || ''} ${currency}`, bold: true, size: 18 })] }),
        new Paragraph({ spacing: { after: 150 }, children: [new TextRun({ text: declaration, size: 16 })] }),
        new Paragraph({ children: [new TextRun({ text: `Total Carton: ${grand.totalCTN} CTN`, bold: true, size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: `Net Weight: ${shipment.totalNetWeightKg || ''} KG`, bold: true, size: 18 })] }),
        new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: `Gross Weight: ${shipment.totalGrossWeightKg || ''} KG`, bold: true, size: 18 })] }),
        // Issue 2 (R25): no signature/stamp block — see the PDF generator's identical comment.
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, filename);
}

// Batch 8 (R5) — Excel version. One sheet, same data top-to-bottom as the DOCX above; XLSX.writeFile
// triggers the browser download itself (same SheetJS call this codebase's Analytics "Export XLSX"
// button already uses), so there's no separate download-trigger step needed here.
export function generateShipmentDocXLSX({ docType, shipment, buyer, exporterInfo = DEFAULT_EXPORTER, filename }) {
  const { title, currency, infoPairs, bankLines, itemHead, itemRows, footRow, grand, declaration, signatoryTitle } = assembleDocData(docType, shipment, buyer, exporterInfo);
  const rows = [
    [exporterInfo.exporterName || 'Shah International'],
    [exporterInfo.exporterAddress || ''],
    [],
    [title],
    [],
    ...infoPairs.filter(([l]) => l).map(([l, v]) => [l, v]),
    [],
    ...(bankLines.length ? [['Bank Details'], ...bankLines.map((l) => [l]), []] : []),
    itemHead,
    ...itemRows,
    footRow,
    [],
    [`Gross Weight: ${shipment.totalGrossWeightKg || ''} KG`, `Freight Cost: ${shipment.freightCost || ''} ${currency}`],
    [],
    [declaration],
    [],
    [`Total Carton: ${grand.totalCTN} CTN`],
    [`Net Weight: ${shipment.totalNetWeightKg || ''} KG`],
    [`Gross Weight: ${shipment.totalGrossWeightKg || ''} KG`],
    // Issue 2 (R25): no signature/stamp block — see the PDF generator's identical comment.
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 36 }, ...itemHead.slice(2).map(() => ({ wch: 16 }))];
  XLSX.utils.book_append_sheet(wb, ws, docTypeLabel(docType.replace('-letterhead', '').replace('-plain', '')).slice(0, 31));
  XLSX.writeFile(wb, filename);
}

// Issue 3: which attachment types generateAllDocumentsPDF can actually merge in — exported so
// callers (e.g. the archive page's "N merged" count and empty-state check) can identify the same
// set without duplicating/drifting from this logic.
export function isMergeableAttachment(doc) {
  const urlLower = `${doc?.url || ''}`.toLowerCase();
  const nameLower = `${doc?.name || ''}`.toLowerCase();
  const isPdf = ['.pdf', '.pdf?', '.pdf#'].some((s) => urlLower.includes(s)) || nameLower.endsWith('.pdf');
  const isJpg = /\.jpe?g(\?|#|$)/.test(urlLower) || /\.jpe?g$/.test(nameLower);
  const isPng = /\.png(\?|#|$)/.test(urlLower) || /\.png$/.test(nameLower);
  return isPdf || isJpg || isPng;
}

// Issue 11 (batch 3): one merged PDF per shipment — "All Documents for (Shipment Name)" —
// combining every generated document (whichever of Packing List / Buyer's Invoice / BD Invoice
// actually has line items) plus any uploaded attachment, in that order, as ONE file. jsPDF alone can
// only build a PDF from scratch; it can't import pages from an already-existing PDF (needed for the
// uploaded attachments) or embed a raster image as a page, so this uses pdf-lib purely for the merge
// step — each generated document is still produced by the exact same generateShipmentDocPDF used
// everywhere else, just merged in afterward.
//
// Issue 3 (batch 4): the "Additional Documents" uploader on the Shipment Details tab explicitly
// accepts PDF *and* image files (.pdf/.jpg/.jpeg/.png), but this merge used to filter to ONLY
// .pdf-named attachments before even trying to fetch anything — any uploaded JPG/PNG was silently
// dropped from the merged file with no trace. Every attachment is now inspected individually: PDFs
// still have their pages copied in as before; JPG/PNG attachments are embedded as their own full
// page (scaled to fit, never upscaled past their original resolution); anything else unrecognized is
// skipped and reported via `skipped`, same as a fetch/parse failure.
//
// Batch 7: the Buyer's Invoice availability check now looks at `shipment.items` (the master table),
// not the old, no-longer-populated `buyerItems` — Buyer's Invoice is a read-only mirror of Shipment
// Details now, so that's the array that actually determines whether it has anything to show.
export async function generateAllDocumentsPDF({ shipment, buyer, letterheadUrl, docStyle = 'letterhead', exporterInfo = DEFAULT_EXPORTER }) {
  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.create();

  const availableDocTypes = [
    { key: 'packing', has: (shipment.items || []).some((i) => i.productName) },
    { key: 'buyer-invoice', has: (shipment.items || []).some((i) => i.productName) },
    { key: 'bd-invoice', has: (shipment.bdItems || []).some((i) => i.productName) },
  ].filter((d) => d.has);

  for (const { key } of availableDocTypes) {
    const pdfDoc = await generateShipmentDocPDF({ docType: `${key}-${docStyle}`, shipment, buyer, letterheadUrl, exporterInfo });
    const bytes = pdfDoc.output('arraybuffer');
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }

  // A4 in points, matching the generated documents above (which are A4 in mm via jsPDF — pdf-lib
  // works in points, 1mm ≈ 2.8346pt, so 210×297mm ≈ 595×842pt).
  const PAGE_W = 595.28, PAGE_H = 841.89, IMG_MARGIN = 28;

  const attachments = (shipment.additionalDocs || []).filter(isMergeableAttachment);
  const skipped = [];
  for (const doc of attachments) {
    const urlLower = `${doc?.url || ''}`.toLowerCase();
    const nameLower = `${doc?.name || ''}`.toLowerCase();
    const isPdf = ['.pdf', '.pdf?', '.pdf#'].some((s) => urlLower.includes(s)) || nameLower.endsWith('.pdf');
    const isJpg = /\.jpe?g(\?|#|$)/.test(urlLower) || /\.jpe?g$/.test(nameLower);
    try {
      const res = await fetch(doc.url);
      const bytes = await res.arrayBuffer();
      if (isPdf) {
        const src = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      } else {
        const img = isJpg ? await merged.embedJpg(bytes) : await merged.embedPng(bytes);
        const scale = Math.min((PAGE_W - IMG_MARGIN * 2) / img.width, (PAGE_H - IMG_MARGIN * 2) / img.height, 1);
        const w = img.width * scale, h = img.height * scale;
        const page = merged.addPage([PAGE_W, PAGE_H]);
        page.drawImage(img, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, width: w, height: h });
      }
    } catch {
      skipped.push(doc.name || doc.url);
    }
  }
  // Attachments that weren't even PDF/JPG/PNG (e.g. a .docx someone uploaded despite the file input's
  // accept filter) can never become a PDF page — report them as skipped too instead of pretending
  // they were considered.
  (shipment.additionalDocs || []).filter((d) => !isMergeableAttachment(d)).forEach((d) => skipped.push(d.name || d.url));

  if (merged.getPageCount() === 0) return { blob: null, skipped };
  const mergedBytes = await merged.save();
  return { blob: new Blob([mergedBytes], { type: 'application/pdf' }), skipped };
}
