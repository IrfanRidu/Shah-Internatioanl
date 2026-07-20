import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Real, byte-exact PDF generation for the 3 export-shipment documents (Packing List, Buyer's
// Commercial Invoice, Bangladeshi Invoice). This is the single source of truth for the "Download PDF"
// action (issue 35) and for the Archive's generated-document files (issue 38) — since the PDF is built
// from the shipment's data directly, it can NEVER contain any website UI/sidebar/nav, unlike a
// print-the-page screenshot approach would risk.
//
// Mirrors the layout of the print view (see app/(print)/print/export/[shipmentId]/page.jsx) so the
// printed copy and the downloaded copy look the same, just produced by two different renderers.

const EXPORTER = {
  name: 'Shah International',
  address: '111 South Bashabo, Opposite of Sabujbagh Thana, Dhaka 1214',
  phone: '01681-896498',
  email: 'shahinternational@gmail.com',
  web: 'www.shahinternational.com',
};

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

function drawHeader(doc, y, letterhead) {
  if (letterhead?.dataUrl && letterhead?.dims) {
    // Scale to fill the content width, capped at a sane header-band height so an oversized or
    // unusually tall upload (e.g. a full scanned page) never swallows the whole document — it always
    // renders as a header BAND, never as full-page artwork.
    const maxHeightMm = 32;
    let renderW = CONTENT_WIDTH;
    let renderH = (letterhead.dims.height / letterhead.dims.width) * renderW;
    if (renderH > maxHeightMm) { renderH = maxHeightMm; renderW = (letterhead.dims.width / letterhead.dims.height) * renderH; }
    const x = MARGIN + (CONTENT_WIDTH - renderW) / 2;
    doc.addImage(letterhead.dataUrl, x, y, renderW, renderH);
    return y + renderH + 6;
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(45, 106, 79);
  doc.text(EXPORTER.name, MARGIN, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(85, 85, 85);
  doc.text(EXPORTER.address, MARGIN, y + 11);
  doc.setFontSize(8);
  doc.text(`Tel: ${EXPORTER.phone}`, PAGE_WIDTH - MARGIN, y + 4, { align: 'right' });
  doc.text(`Email: ${EXPORTER.email}`, PAGE_WIDTH - MARGIN, y + 8, { align: 'right' });
  doc.text(`Web: ${EXPORTER.web}`, PAGE_WIDTH - MARGIN, y + 12, { align: 'right' });
  doc.setDrawColor(45, 106, 79); doc.setLineWidth(0.6);
  doc.line(MARGIN, y + 16, PAGE_WIDTH - MARGIN, y + 16);
  return y + 21;
}

function drawTitle(doc, y, title) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
  doc.text(title, PAGE_WIDTH / 2, y, { align: 'center' });
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
  doc.line(MARGIN, y + 3, PAGE_WIDTH - MARGIN, y + 3);
  return y + 9;
}

// rows: array of [label, value] pairs, laid out 2-per-line like the original 2-column layout.
function drawInfoGrid(doc, y, rows) {
  doc.setFontSize(8.5);
  let cursorY = y;
  for (let i = 0; i < rows.length; i += 2) {
    const leftX = MARGIN, rightX = MARGIN + CONTENT_WIDTH / 2 + 2;
    const pair = [rows[i], rows[i + 1]];
    const colWidth = CONTENT_WIDTH / 2 - 4;
    pair.forEach(([label, val], idx) => {
      if (!label) return;
      const x = idx === 0 ? leftX : rightX;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20);
      doc.text(`${label}:`, x, cursorY);
      const labelW = doc.getTextWidth(`${label}: `);
      doc.setFont('helvetica', 'normal');
      doc.text(String(val || ''), x + labelW, cursorY, { maxWidth: colWidth - labelW });
    });
    cursorY += 5;
  }
  return cursorY + 3;
}

function drawBankLine(doc, y, shipment) {
  if (!shipment.beneficiaryBank) return y;
  doc.setFillColor(249, 249, 249);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 7, 'F');
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20);
  const text = `Beneficiary Bank: ${shipment.beneficiaryBank}  |  Acc: ${shipment.accountNo || ''}  |  ${shipment.branchName || ''}  |  Routing: ${shipment.routingNo || ''}  |  SWIFT: ${shipment.swiftCode || ''}`;
  doc.text(text, MARGIN + 2, y + 4.5, { maxWidth: CONTENT_WIDTH - 4 });
  return y + 10;
}

function drawSignature(doc, y) {
  const lineY = Math.min(Math.max(y, 255), 280);
  doc.setDrawColor(30, 30, 30); doc.setLineWidth(0.3);
  doc.line(PAGE_WIDTH - MARGIN - 45, lineY, PAGE_WIDTH - MARGIN, lineY);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
  doc.text('Proprietor', PAGE_WIDTH - MARGIN - 45, lineY + 5);
  doc.text('Shah International', PAGE_WIDTH - MARGIN - 45, lineY + 9.5);
}

export async function generatePackingListPDF({ shipment, buyer, letterheadUrl }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const letterhead = await loadImageForPdf(letterheadUrl);
  let y = MARGIN;
  y = drawHeader(doc, y, letterhead);
  y = drawTitle(doc, y, 'Packing List');

  y = drawInfoGrid(doc, y, [
    ['Exporter', 'Shah International, 111 South Bashabo'], ['Country of Origin', shipment.countryOfOrigin || 'Bangladesh'],
    ['Contract No', shipment.contractNo], ['Importer', `${buyer?.name || ''}, ${buyer?.address || ''}`],
    ['TIN', shipment.tinNo], ['BIN', shipment.binNo],
    ['Sales Term', shipment.salesTerm], ['ERC', shipment.ercNo],
    ['Mode of Carrying', shipment.modeOfCarrying], ['EXP No', shipment.expNo],
    ['Landing Port', shipment.landingPort], ['AWB', shipment.awbNo],
    ['Port of Discharge', shipment.portOfDischarge], ['PC', shipment.pcNo],
    ['Final Destination', shipment.finalDestination], [null, null],
  ]);

  y = drawBankLine(doc, y, shipment);

  const items = (shipment.items || []).filter(i => i.productName);
  const totalCTN = items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const totalQty = items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [['SL', 'Name of Products', 'Botanical Name', 'Pack Size (KG)', 'Total CTN', 'Quantity KG']],
    body: items.map((item, i) => [i + 1, item.productName, item.botanicalName || '', item.packSizeKg || '', item.totalCTN || '', item.quantityKg || '']),
    foot: [['', '', '', 'Grand Total:', totalCTN, totalQty.toFixed(1)]],
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 26], fontSize: 8 },
    footStyles: { fillColor: [232, 245, 233], textColor: [20, 20, 20], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 1.5 },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = doc.lastAutoTable.finalY + 5;

  doc.setFillColor(245, 245, 245); doc.rect(MARGIN, y, CONTENT_WIDTH, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
  doc.text(`Gross Weight: ${shipment.totalGrossWeightKg || ''} KG    Freight Cost: ${shipment.freightCost || ''}`, MARGIN + 2, y + 4.5);
  y += 11;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  const certLines = doc.splitTextToSize('We hereby certify that the information on this invoice is true and correct and that the contents of this shipment are as stated above.', CONTENT_WIDTH);
  doc.text(certLines, MARGIN, y);
  y += certLines.length * 3.5 + 2;
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Carton: ${totalCTN} CTN    Net Weight: ${shipment.totalNetWeightKg || ''} KG    Gross Weight: ${shipment.totalGrossWeightKg || ''} KG`, MARGIN, y);

  drawSignature(doc, y + 30);
  return doc;
}

export async function generateInvoicePDF({ shipment, buyer, letterheadUrl, type }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const letterhead = await loadImageForPdf(letterheadUrl);
  const isBuyer = type === 'buyer-invoice';
  const currency = shipment.baseCurrency || 'EUR';
  const items = (isBuyer ? shipment.buyerItems : shipment.bdItems || []).filter(i => i.productName);

  let y = MARGIN;
  y = drawHeader(doc, y, letterhead);
  y = drawTitle(doc, y, isBuyer ? 'Commercial Invoice' : 'Bangladeshi Invoice');

  y = drawInfoGrid(doc, y, [
    ['Exporter', 'Shah International, 111 South Bashabo'], ['Country of Origin', shipment.countryOfOrigin || 'Bangladesh'],
    ['Sales Term', shipment.salesTerm], ['Importer', `${buyer?.name || ''}, ${buyer?.address || ''}`],
    ['TIN', shipment.tinNo], ['BIN', shipment.binNo],
    ['Mode of Carrying', shipment.modeOfCarrying], ['ERC', shipment.ercNo],
    ['EXP', shipment.expNo], ['Landing Port', shipment.landingPort],
    ['AWB', shipment.awbNo], ['PC', shipment.pcNo],
    ['Port of Discharge', shipment.portOfDischarge], ['Final Destination', shipment.finalDestination],
  ]);

  y = drawBankLine(doc, y, shipment);

  const totalCTN = items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const totalQty = items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
  const totalValue = items.reduce((a, r) => a + (Number(r.totalValue) || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [['SL', 'Name of Products (Botanical Name)', 'Total CTN', 'Qty KG', 'Unit Price', `Total ${currency} (CFR)`]],
    body: items.map((item, i) => [
      i + 1,
      item.botanicalName ? `${item.productName} (${item.botanicalName})` : item.productName,
      item.totalCTN || '', item.quantityKg || '', Number(item.unitPrice || 0).toFixed(2), `${Number(item.totalValue || 0).toFixed(2)} ${currency}`,
    ]),
    foot: [['', 'Grand Total:', totalCTN, totalQty.toFixed(1), '', `${totalValue.toFixed(2)} ${currency}`]],
    theme: 'grid',
    headStyles: { fillColor: [26, 26, 26], fontSize: 8 },
    footStyles: { fillColor: [232, 245, 233], textColor: [45, 106, 79], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 1.5 },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = doc.lastAutoTable.finalY + 5;

  doc.setFillColor(245, 245, 245); doc.rect(MARGIN, y, CONTENT_WIDTH, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
  doc.text(`Gross Weight: ${shipment.totalGrossWeightKg || ''} KG    Freight Cost: ${shipment.freightCost || ''}`, MARGIN + 2, y + 4.5);
  y += 11;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  const certLines = doc.splitTextToSize(
    'THE EXPORTER SHAH INTERNATIONAL, OF THE PRODUCTS COVERED BY THIS DOCUMENT, DECLARES THAT, EXCEPT WHERE OTHERWISE CLEARLY INDICATED, THESE PRODUCTS ARE OF BANGLADESH PREFERENTIAL ORIGIN ACCORDING TO THE RULES OF THE GENERALIZED SYSTEM OF PREFERENCES OF THE EUROPEAN UNION. We hereby certify that the information on this invoice is true and correct and that the contents of this shipment are as stated above.',
    CONTENT_WIDTH
  );
  doc.text(certLines, MARGIN, y);
  y += certLines.length * 3.2 + 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.text(`Total Carton: ${totalCTN} CTN   Net Weight: ${shipment.totalNetWeightKg || ''} KG   Gross Weight: ${shipment.totalGrossWeightKg || ''} KGS`, MARGIN, y);

  drawSignature(doc, y + 30);
  return doc;
}

// Single entry point mirroring the print route's docType convention (e.g. "packing-letterhead",
// "buyer-invoice-plain") so both Print and Download stay driven by the exact same doc-type strings.
export async function generateShipmentDocPDF({ docType, shipment, buyer, letterheadUrl }) {
  const withLetterhead = docType.includes('letterhead');
  const baseType = docType.replace('-letterhead', '').replace('-plain', '');
  const effectiveLetterhead = withLetterhead ? letterheadUrl : '';
  if (baseType === 'packing') return generatePackingListPDF({ shipment, buyer, letterheadUrl: effectiveLetterhead });
  return generateInvoicePDF({ shipment, buyer, letterheadUrl: effectiveLetterhead, type: baseType });
}

export function docTypeLabel(baseType) {
  if (baseType === 'packing') return 'Packing List';
  if (baseType === 'buyer-invoice') return "Buyer's Invoice";
  if (baseType === 'bd-invoice') return 'BD Invoice';
  return baseType;
}
