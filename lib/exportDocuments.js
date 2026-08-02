import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDocumentColumns, shouldShowBdHsCode, columnHeaderLabel } from './exportColumns';

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

const PAGE_WIDTH = 210; // A4, mm
const MARGIN = 12;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Fetches a (Cloudinary) image URL and returns a data URL jsPDF can embed, plus its pixel dimensions
// (needed to scale it proportionally). Returns nulls on any failure (offline, CORS, bad URL) so the
// caller can gracefully fall back to the plain text header instead of failing the whole PDF.
async function loadImageForPdf(url) {
  if (!url) return { dataUrl: null, dims: null };
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    return dims ? { dataUrl, dims } : { dataUrl: null, dims: null };
  } catch {
    return { dataUrl: null, dims: null };
  }
}

// R2: plain A4 must be exactly that — no banner or graphic of any kind, matching the reference
// documents exactly. `plain` short-circuits before drawing anything at all, leaving `y` untouched.
// Letterhead mode either embeds the real uploaded image (if banner-shaped — issue 7) or falls back
// to a coded banner using the shipment's actual exporter identity.
function drawHeader(doc, y, letterhead, exporterInfo, plain) {
  if (plain) return y;
  const isBannerShaped = letterhead?.dims && (letterhead.dims.width / letterhead.dims.height) >= 2;

  if (letterhead?.dataUrl && isBannerShaped) {
    // Scale to fill the content width, capped at a sane header-band height so an oversized upload
    // never swallows the whole document — it always renders as a header BAND, never full-page artwork.
    const maxHeightMm = 32;
    let renderW = CONTENT_WIDTH;
    let renderH = (letterhead.dims.height / letterhead.dims.width) * renderW;
    if (renderH > maxHeightMm) { renderH = maxHeightMm; renderW = (letterhead.dims.width / letterhead.dims.height) * renderH; }
    const x = MARGIN + (CONTENT_WIDTH - renderW) / 2;
    doc.addImage(letterhead.dataUrl, x, y, renderW, renderH);
    return y + renderH + 6;
  }

  // Coded banner fallback — only reached in letterhead MODE when nothing's been uploaded yet.
  const bandH = 22;
  doc.setFillColor(26, 61, 46);
  doc.rect(MARGIN, y, CONTENT_WIDTH, bandH, 'F');
  doc.setFont('times', 'bolditalic'); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
  doc.text(exporterInfo.exporterName || 'Shah International', MARGIN + 6, y + 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(240, 240, 240);
  const addrLines = doc.splitTextToSize(exporterInfo.exporterAddress || '', CONTENT_WIDTH * 0.5);
  addrLines.forEach((line, i) => doc.text(line, PAGE_WIDTH - MARGIN - 2, y + 8 + i * 3.6, { align: 'right' }));
  return y + bandH + 6;
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

function drawSignature(doc, y, exporterInfo) {
  const lineY = Math.min(Math.max(y, 255), 280);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  doc.line(PAGE_WIDTH - MARGIN - 45, lineY, PAGE_WIDTH - MARGIN, lineY);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
  doc.text('Proprietor', PAGE_WIDTH - MARGIN - 45, lineY + 5);
  doc.text(exporterInfo.exporterName || 'Shah International', PAGE_WIDTH - MARGIN - 45, lineY + 9.5);
}

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
const PLAIN_TABLE_STYLE = {
  theme: 'grid',
  headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2, fontSize: 8 },
  footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2, fontSize: 8 },
  bodyStyles: { textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.15, fontSize: 8 },
  alternateRowStyles: { fillColor: [255, 255, 255] },
  styles: { cellPadding: 1.5 },
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
    ['EXP No', shipment.expNo], ['Final Destination', shipment.finalDestination],
    ['AWB', shipment.awbNo], [null, null],
    ['PC', shipment.pcNo], [null, null],
  ]);

  y = drawBankLine(doc, y, shipment);

  const items = (shipment.items || []).filter((i) => i.productName);
  const grand = grandTotals(items);
  const currency = shipment.baseCurrency || 'EUR';
  const columns = getDocumentColumns(shipment.exportCategory, 'packingList');

  autoTable(doc, {
    startY: y,
    head: [['SL NO.', 'Name of Products (Botanical Name)', ...columns.map((k) => columnHeaderLabel(k, currency))]],
    body: items.map((item, i) => [
      i + 1,
      item.botanicalName ? `${item.productName} (${item.botanicalName})` : item.productName,
      ...columns.map((k) => cellText(k, item, currency)),
    ]),
    foot: [['', 'Grand Total :', ...columns.map((k) => grandCellText(k, grand, currency))]],
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
  const certLines = doc.splitTextToSize('1. We hereby certify that the information on this invoice is true and correct and that contents of this shipment are as state above.', CONTENT_WIDTH - 4);
  const boxTop = y;
  doc.text(certLines, MARGIN + 2, y + 4);
  y += certLines.length * 3.5 + 3;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Carton: ${grand.totalCTN} CTN`, MARGIN + 2, y); y += 4;
  doc.text(`Net Weight: ${shipment.totalNetWeightKg || ''} KG`, MARGIN + 2, y); y += 4;
  doc.text(`Gross Weight: ${shipment.totalGrossWeightKg || ''} KG`, MARGIN + 2, y);
  doc.rect(MARGIN, boxTop, CONTENT_WIDTH, y - boxTop + 4);
  y += 8;

  drawSignature(doc, y + 25, exporterInfo);
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
  const showBdHsCode = !isBuyer && shouldShowBdHsCode(shipment.exportCategory);

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
    ['EXP', shipment.expNo], ['Final Destination', shipment.finalDestination],
    ['AWB', shipment.awbNo], [null, null],
    ['PC', shipment.pcNo], [null, null],
  ]);

  y = drawBankLine(doc, y, shipment);

  const grand = grandTotals(items);

  autoTable(doc, {
    startY: y,
    head: [['SL', 'Name of Products (Botanical Name)', ...columns.map((k) => columnHeaderLabel(k, currency))]],
    body: items.map((item, i) => {
      let name = item.botanicalName ? `${item.productName} (${item.botanicalName})` : item.productName;
      if (showBdHsCode && item.hsCode) name += `\nH.S Code : ${item.hsCode}`;
      return [i + 1, name, ...columns.map((k) => cellText(k, item, currency))];
    }),
    foot: [['', 'Grand Total :', ...columns.map((k) => grandCellText(k, grand, currency))]],
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
  // the SAME simple declaration as Packing List.
  doc.setFont('helvetica', 'normal'); doc.setFontSize(isBuyer ? 6.8 : 7.5);
  const declarationText = isBuyer
    ? `THE EXPORTER ${(exporterInfo.exporterName || 'SHAH INTERNATIONAL').toUpperCase()}. BDREX${shipment.rexNo || ''} OF THE PRODUCTS COVERED BY THIS DOCUMENTS DECLARES THAT, EXCEPT WHERE OTHERWISE CLEARLY INDICATED. THESE PRODUCTS ARE OF BANGLADESH PREFERENTIAL ORIGIN (5) ACCORDING TO RULES OF THE GENERALIZED SYSTEM OF PREFERENCES OF THE EUROPEAN UNION AND THAT THE ORIGIN CRITERION MET IS W 0709,0714,0710, 0810 (07119000)1. We hereby certify that the information on this invoice is true and correct and that contents of this shipment are as state above.`
    : '1. We hereby certify that the information on this invoice is true and correct and that contents of this shipment are as state above.';
  const certLines = doc.splitTextToSize(declarationText, CONTENT_WIDTH - 4);
  const boxTop = y;
  doc.text(certLines, MARGIN + 2, y + 4);
  y += certLines.length * (isBuyer ? 3.0 : 3.5) + 3;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text(`Total Carton: ${grand.totalCTN} CTN`, MARGIN + 2, y); y += 4;
  doc.text(`Net Weight: ${shipment.totalNetWeightKg || ''} KG`, MARGIN + 2, y); y += 4;
  doc.text(`Gross Weight: ${shipment.totalGrossWeightKg || ''} KG`, MARGIN + 2, y);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.25);
  doc.rect(MARGIN, boxTop, CONTENT_WIDTH, y - boxTop + 4);
  y += 8;

  drawSignature(doc, y + 25, exporterInfo);
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
