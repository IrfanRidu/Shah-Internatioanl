'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { generateShipmentDocPDF, docTypeLabel, resolveDocumentText } from '@/lib/exportDocuments';
import { getDocumentColumns, columnHeaderLabel, avgPrice } from '@/lib/exportColumns';
import { LETTERHEAD_CONTENT_START_MM } from '@/lib/pdfLetterhead';

// This print container's own top padding (12mm, matching where it's set further down) stacks
// underneath DocHeader's spacer div (a normal-flow element, unlike its absolutely-positioned image,
// which ignores the container's padding entirely per how CSS resolves an absolute element's
// containing block) — subtracted from the spacer's own height so the two together land content at
// the SAME 45mm-from-the-printable-area's-own-top-edge the PDF generator uses, not 12mm further
// down than that.
const CONTAINER_PADDING_MM = 12;

// Batch 17 (R5): matches PLAIN_TOP_MARGIN in lib/exportDocuments.js — see that file's drawHeader
// comment for the full reasoning (plain/no-letterhead documents are meant to be printed directly
// onto, or laid over, paper that may already have a physical company letterhead pre-printed on it,
// and need a safe 1" clearance so content can't visually overlap it).
const PLAIN_TOP_MARGIN_MM = 25.4;

// ─── Shared plain/formal styling — batch 7: the previous dark-header / colored-row / coded-banner
// look did not match the reference documents at all (Packing_List.pdf, Buyer_s_Invoice_.pdf,
// BD_Invoice.pdf — plain black text on white, thin black borders, no fill colors anywhere). Every
// style constant below intentionally has NO backgroundColor.
const TITLE_STYLE = { textAlign: 'center', fontSize: '14px', fontWeight: '700', marginBottom: '10px' };
const CELL = { padding: '4px 6px', borderRight: '1px solid #000', borderBottom: '1px solid #000', verticalAlign: 'top' };
const CELL_LAST = { padding: '4px 6px', borderBottom: '1px solid #000', verticalAlign: 'top' };
const TABLE_STYLE = { width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', border: '1px solid #000' };
const TH = { padding: '5px 4px', textAlign: 'center', border: '1px solid #000', fontWeight: 'bold' };
const TD = { padding: '4px', border: '1px solid #000', textAlign: 'center' };
const TDC = { ...TD, textAlign: 'center' };
const SUMMARY_LINE = { fontSize: '10px', marginTop: '8px', padding: '5px 6px', border: '1px solid #000' };
const DECLARATION_STYLE = { fontSize: '9px', marginTop: '8px', lineHeight: '1.5', border: '1px solid #000', padding: '8px' };
// Wraps every piece of a document's actual content (title/InfoGrid/table/summary/declaration —
// everything EXCEPT DocHeader's own image+spacer) so it reliably paints ABOVE the letterhead image
// rather than being covered by it. Per CSS's default stacking order, a `position: absolute` element
// (DocHeader's <img>, z-index:auto) always paints above normal-flow/static siblings in the same
// stacking context, REGARDLESS of DOM order — so on any shipment whose uploaded letterhead happens
// to render taller than the fixed clearance the spacer reserves (LETTERHEAD_CONTENT_START_MM), the
// image was visually covering all of this instead of the other way around: "blank, only the empty
// letterhead is showing" was every one of these elements still being there in the DOM, just hidden
// underneath the image in paint order. Any element with an explicit positive z-index paints above a
// z-index:auto sibling unconditionally, so z-index:1 here (matched against the image's implicit
// auto/0) is enough — this doesn't need to coordinate with exactly which ancestor establishes the
// actual stacking context, only that both are compared directly as siblings, which they are (both
// are direct children of the position:relative print container in PrintPage below). Mirrors what
// FIX A (PLAIN_TABLE_STYLE's fillColor:false) does for the downloaded PDF: the letterhead stays
// fully visible everywhere, with only text and the table's own grid lines drawn on top of it.
const CONTENT_LAYER_STYLE = { position: 'relative', zIndex: 1 };

// Same rendering logic as the admin editor's ReadOnlyItemsView (lib/exportColumns.js's registry is
// the shared source of truth) — kept local here since jsPDF and React/HTML need separate renderers,
// but both read the identical column keys/order so a printed document never disagrees with what the
// admin saw while editing it.
function renderItemCell(key, item) {
  switch (key) {
    case 'hsCode': return item.hsCode || '—';
    case 'packSizeKg': return item.ctnSizeKg || '—';
    case 'totalCTN': return item.totalCTN || 0;
    case 'quantityKg': return Number(item.quantityKg || 0).toFixed(1);
    case 'unitPrice': return Number(item.unitPrice || 0).toFixed(2);
    case 'averagePrice': return avgPrice(item.totalValue, item.quantityKg) ? avgPrice(item.totalValue, item.quantityKg).toFixed(2) : '—';
    case 'totalValue': return Number(item.totalValue || 0).toFixed(2);
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
function renderGrandCell(key, grand) {
  switch (key) {
    case 'totalCTN': return grand.totalCTN;
    case 'quantityKg': return grand.quantityKg.toFixed(1);
    case 'averagePrice': return grand.quantityKg ? avgPrice(grand.totalValue, grand.quantityKg).toFixed(2) : '';
    case 'totalValue': return grand.totalValue.toFixed(2);
    default: return '';
  }
}

// Shared header for all documents. Letterhead comes from the shipment's Export License if it has
// one, else the GLOBAL company setting (issue 39, requirement 7) — resolved by the caller, this
// component just renders whatever URL it's given.
// Issue 9 (R24) / issue 2 (R25) / issue 1 (R26): matches the downloaded PDF's own letterhead
// handling exactly now (lib/pdfLetterhead.js) — the uploaded image is trusted at its own natural
// aspect ratio, full width, never cropped or distorted. Positioned absolutely (out of normal
// document flow) so its own rendered height can never push the rest of the page's content down, or
// affect print pagination — a real admin's actual uploaded letterhead was measured to render far
// taller (~80mm, mostly blank padding baked into the file) than its visible graphic (~20mm), and
// with the image previously sitting in normal flow, that reserved space was both an oversized gap
// AND, combined with everything after it, enough to push the whole rest of the page onto a second
// printed page. The spacer below reserves a small FIXED clearance instead (same constant the PDF
// generator uses, so print and download match exactly) — content now starts at a predictable
// position regardless of how tall the uploaded file itself happens to be.
function DocHeader({ letterheadUrl, exporterInfo, plain, onLetterheadLoad }) {
  // Batch 17 (R5): no image is ever drawn in either of these two cases (Plain A4 explicitly
  // chosen, or letterhead mode requested but nothing is configured/loadable for this shipment yet)
  // — reserve the same safe 1" clearance the PDF download uses instead of rendering nothing at
  // all, so content can never visually overlap a physical pre-printed letterhead the paper itself
  // might already have. Mirrors the image branch's own spacer-height formula below exactly, just
  // with the 1" constant in place of LETTERHEAD_CONTENT_START_MM.
  if (plain || !letterheadUrl) return <div style={{ height: `${PLAIN_TOP_MARGIN_MM - CONTAINER_PADDING_MM}mm` }} />;
  return (
    <>
      <img
        src={letterheadUrl}
        alt="Letterhead"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'auto', display: 'block' }}
        onLoad={onLetterheadLoad}
        onError={onLetterheadLoad}
      />
      <div style={{ height: `${LETTERHEAD_CONTENT_START_MM - CONTAINER_PADDING_MM}mm` }} />
    </>
  );
}

// R1-R4: the header info block is the same on every document, always auto-filled from the
// shipment — used by Packing List, Buyer's Invoice, and BD Invoice alike.
function InfoGrid({ shipment, buyer, exporterInfo }) {
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
  // EXP/AWB/PC each carry their own date (expDate/awbDate/pcDate) — rendered as Label | Value |
  // Date within the SAME left-column cell the rest of this grid already uses, a vertical rule
  // between value and date, date right-aligned, matching the reference document precisely. A
  // nested flex row rather than a 3rd CSS grid column: this stays automatically contained within
  // the existing 1fr-wide left column (can't spill into the right column the way the jsPDF path's
  // manual coordinate math briefly did — see drawIdentifierTable's own comment in
  // lib/exportDocuments.js for that fix), no separate width tuning needed on this side.
  const idRow = { display: 'flex', alignItems: 'baseline', gap: '4px' };
  const idLabel = { fontWeight: 'bold', flexShrink: 0 };
  const idValue = { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const idDate = { borderLeft: '1px solid #000', paddingLeft: '6px', textAlign: 'right', flexShrink: 0, minWidth: '62px' };
  return (
    <div style={{ border: '1px solid #000', marginBottom: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '9.5px' }}>
        <div style={CELL}><b>Exporter :</b> {exporterInfo.exporterName}<br />{exporterInfo.exporterAddress}</div>
        <div style={CELL_LAST}><b>Country Of Origin:</b> {shipment.countryOfOrigin || 'Bangladesh'}<br /><b>Sales Term:</b> {shipment.salesTerm}</div>

        <div style={CELL}><b>Contract No :</b> {shipment.contractNo} &nbsp; <b>Invoice No:</b> {shipment.invoiceNo}{shipment.date ? ` DT:${fmtDate(shipment.date)}` : ''}</div>
        <div style={CELL_LAST}><b>Importer :</b> {buyer?.name}<br />{buyer?.address}</div>

        <div style={CELL}><b>TIN :</b> {shipment.tinNo}</div>
        <div style={CELL_LAST}><b>Mode of Carrying :</b> {shipment.modeOfCarrying}</div>

        <div style={CELL}><b>BIN :</b> {shipment.binNo}</div>
        <div style={CELL_LAST}><b>Landing Port :</b> {shipment.landingPort}</div>

        <div style={CELL}><b>ERC :</b> {shipment.ercNo}</div>
        <div style={CELL_LAST}><b>Port Of Discharge :</b> {shipment.portOfDischarge}</div>

        <div style={CELL}>
          <div style={idRow}><span style={idLabel}>EXP</span><span style={idValue}>{shipment.expNo}</span><span style={idDate}>{fmtDate(shipment.expDate)}</span></div>
        </div>
        <div style={CELL_LAST}><b>Final Destination :</b> {shipment.finalDestination}</div>

        <div style={CELL}>
          <div style={idRow}><span style={idLabel}>AWB</span><span style={idValue}>{shipment.awbNo}</span><span style={idDate}>{fmtDate(shipment.awbDate)}</span></div>
        </div>
        <div style={CELL_LAST}></div>

        <div style={{ ...CELL, borderBottom: shipment.beneficiaryBank ? '1px solid #000' : 'none' }}>
          <div style={idRow}><span style={idLabel}>PC</span><span style={idValue}>{shipment.pcNo}</span><span style={idDate}>{fmtDate(shipment.pcDate)}</span></div>
        </div>
        <div style={{ ...CELL_LAST, borderBottom: shipment.beneficiaryBank ? '1px solid #000' : 'none' }}></div>
      </div>
      {shipment.beneficiaryBank && (
        <div style={{ fontSize: '9.5px', padding: '5px 6px' }}>
          <b>Beneficiary Bank :</b> {shipment.beneficiaryBank}<br />
          Account Number : {shipment.accountNo}<br />
          {shipment.branchName}<br />
          {shipment.bankAddress && <>{shipment.bankAddress}<br /></>}
          Routing Number : {shipment.routingNo}<br />
          Swift Code : {shipment.swiftCode}
        </div>
      )}
    </div>
  );
}

// SignatureBlock (a drawn "line + Proprietor + company name") was removed in R25 (issue 2) — no
// signature/stamp is printed for Packing List/Buyer's Invoice/BD Invoice any more; a physical
// company stamp is added by hand afterward, which is exactly what that block used to stand in for.

// R2: Packing List — SL/Name+Botanical always shown, plus whichever columns this shipment's Export
// Category enables (packSizeKg/totalCTN/quantityKg by default — the Fresh Fruits & Vegetables
// reference format).
function PackingListDoc({ shipment, buyer, letterheadUrl, exporterInfo, plain, onLetterheadLoad }) {
  const items = (shipment.items || []).filter((i) => i.productName);
  const grand = grandTotals(items);
  const columns = getDocumentColumns(shipment.exportCategory, 'packingList');
  const { declaration, signatoryTitle } = resolveDocumentText('packingList', shipment, exporterInfo);

  return (
    <>
      <DocHeader letterheadUrl={letterheadUrl} exporterInfo={exporterInfo} plain={plain} onLetterheadLoad={onLetterheadLoad} />
      <div style={CONTENT_LAYER_STYLE}>
      <h2 style={TITLE_STYLE}>Packing List</h2>
      <InfoGrid shipment={shipment} buyer={buyer} exporterInfo={exporterInfo} />

      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={TH}>SL NO.</th>
            <th style={{ ...TH, textAlign: 'left' }}>Name of Products<br />(Botanical Name)</th>
            {columns.map((k) => <th key={k} style={TH}>{columnHeaderLabel(k, shipment.baseCurrency, shipment.salesTerm)}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={TDC}>{i + 1}</td>
              <td style={TD}>{item.productName}{item.botanicalName && <span style={{ fontStyle: 'italic' }}> ({item.botanicalName})</span>}</td>
              {columns.map((k) => <td key={k} style={TDC}>{renderItemCell(k, item)}</td>)}
            </tr>
          ))}
          <tr style={{ fontWeight: 'bold' }}>
            <td colSpan={2} style={{ ...TD, textAlign: 'right' }}>Grand Total :</td>
            {columns.map((k) => <td key={k} style={TDC}>{renderGrandCell(k, grand)}</td>)}
          </tr>
        </tbody>
      </table>

      <div style={SUMMARY_LINE}>
        <b>Gross Weight : {shipment.totalGrossWeightKg} KG &nbsp;&nbsp; Freight Cost : {shipment.freightCost} {shipment.baseCurrency}</b>
      </div>

      <div style={DECLARATION_STYLE}>
        {declaration}<br />
        <b>Total Carton: {grand.totalCTN} CTN</b><br />
        <b>Net Weight: {shipment.totalNetWeightKg} KG</b><br />
        <b>Gross Weight: {shipment.totalGrossWeightKg} KG</b>
      </div>
      </div>
    </>
  );
}

// R3/R4: Buyer's Invoice and BD Invoice share this component (both headed "Commercial Invoice"),
// but differ in: item source (Buyer's Invoice mirrors the master `items`; BD Invoice uses its own
// small admin-editable `bdItems`, one row per product category — see the shipment editor), column
// set (registry key; batch 17 gives BD Invoice its own HS Code column), name header/cell (batch
// 17: BD Invoice rows are category names, so no botanical name applies there), and declaration
// text (Buyer's Invoice gets the full BDREX/GSP paragraph; BD Invoice gets the same simple one as
// Packing List).
function InvoiceDoc({ shipment, buyer, letterheadUrl, exporterInfo, plain, type, onLetterheadLoad }) {
  const isBuyer = type === 'buyer-invoice';
  const items = (isBuyer ? shipment.items : shipment.bdItems || []).filter((i) => i.productName);
  const currency = shipment.baseCurrency || 'EUR';
  const grand = grandTotals(items);
  const columns = getDocumentColumns(shipment.exportCategory, isBuyer ? 'buyerInvoice' : 'bdInvoice');
  const { declaration, signatoryTitle } = resolveDocumentText(isBuyer ? 'buyerInvoice' : 'bdInvoice', shipment, exporterInfo);

  return (
    <>
      <DocHeader letterheadUrl={letterheadUrl} exporterInfo={exporterInfo} plain={plain} onLetterheadLoad={onLetterheadLoad} />
      <div style={CONTENT_LAYER_STYLE}>
      <h2 style={TITLE_STYLE}>Commercial Invoice</h2>
      <InfoGrid shipment={shipment} buyer={buyer} exporterInfo={exporterInfo} />

      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={TH}>SL NO.</th>
            {isBuyer ? (
              <th style={{ ...TH, textAlign: 'left' }}>Name of Products<br />(Botanical Name)</th>
            ) : (
              <th style={{ ...TH, textAlign: 'left' }}>Name of Products</th>
            )}
            {columns.map((k) => <th key={k} style={TH}>{columnHeaderLabel(k, currency, shipment.salesTerm)}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={TDC}>{i + 1}</td>
              <td style={TD}>
                {item.productName}
                {isBuyer && item.botanicalName && <><br /><span style={{ fontStyle: 'italic', fontSize: '8.5px' }}>({item.botanicalName})</span></>}
              </td>
              {columns.map((k) => <td key={k} style={TDC}>{renderItemCell(k, item)}</td>)}
            </tr>
          ))}
          <tr style={{ fontWeight: 'bold' }}>
            <td colSpan={2} style={{ ...TD, textAlign: 'right' }}>Grand Total :</td>
            {columns.map((k) => <td key={k} style={TDC}>{renderGrandCell(k, grand)}</td>)}
          </tr>
        </tbody>
      </table>

      <div style={SUMMARY_LINE}>
        <b>Gross Weight : {shipment.totalGrossWeightKg} KG &nbsp;&nbsp; Freight Cost : {shipment.freightCost} {currency}</b>
      </div>

      <div style={DECLARATION_STYLE}>
        {declaration}<br />
        <b>Total Carton: {grand.totalCTN} CTN</b><br />
        <b>Net Weight: {shipment.totalNetWeightKg} KG</b><br />
        <b>Gross Weight: {shipment.totalGrossWeightKg} KG</b>
      </div>
      </div>
    </>
  );
}

export default function PrintPage() {
  const { shipmentId } = useParams();
  const searchParams = useSearchParams();
  const docType = searchParams.get('doc') || 'packing-plain';
  const [shipment, setShipment] = useState(null);
  const [buyer, setBuyer] = useState(null);
  const [letterheadUrl, setLetterheadUrl] = useState('');
  const [exporterInfo, setExporterInfo] = useState({ exporterName: 'Shah International', exporterAddress: '' });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const printedRef = useRef(false);

  const withLetterhead = docType.includes('letterhead');
  const baseDocType = docType.replace('-letterhead', '').replace('-plain', '');

  useEffect(() => {
    Promise.all([
      fetch(`/api/export/shipments/${shipmentId}`).then((r) => r.json()),
      // Global company setting (issue 39, R1) — the fallback letterhead/exporter identity used
      // whenever this shipment has no Export License selected, or its license has no letterhead.
      fetch('/api/settings').then((r) => r.json()).catch(() => null),
    ]).then(([shipmentRes, settingsRes]) => {
      setShipment(shipmentRes.shipment);
      setBuyer(shipmentRes.shipment?.buyer);
      const effectiveLetterheadUrl = shipmentRes.shipment?.exportLicense?.letterheadUrl || settingsRes?.settings?.exportLetterheadUrl || '';
      setLetterheadUrl(withLetterhead ? effectiveLetterheadUrl : '');
      setExporterInfo({
        exporterName: settingsRes?.settings?.exporterName || 'Shah International',
        exporterAddress: settingsRes?.settings?.exporterAddress || '',
      });
      setLoading(false);
    });
  }, [shipmentId, withLetterhead]);

  // Print only once everything that needs to be on the page actually IS on the page — no blind
  // fixed-delay guess that could fire before a letterhead image finished loading.
  const triggerPrintWhenReady = useCallback(() => {
    if (printedRef.current) return;
    printedRef.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => window.print(), 150)));
  }, []);

  useEffect(() => {
    if (loading || !shipment) return;
    // If there's no letterhead image to wait for, print almost immediately; the image case is
    // handled by DocHeader's onLoad/onError calling triggerPrintWhenReady directly instead.
    if (!letterheadUrl) triggerPrintWhenReady();
  }, [loading, shipment, letterheadUrl, triggerPrintWhenReady]);

  const handleDownload = async () => {
    if (!shipment) return;
    setDownloading(true);
    try {
      const doc = await generateShipmentDocPDF({ docType, shipment, buyer, letterheadUrl, exporterInfo });
      doc.save(`${docTypeLabel(baseDocType).replace(/\s+/g, '-')}-${shipment.shipmentNo || shipmentId}.pdf`);
    } catch {
      // no-op — Print is still available as a fallback if PDF generation fails for any reason
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={{ fontFamily: 'Arial, sans-serif', padding: '40px', textAlign: 'center' }}>Loading document...</div>;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 15mm 12mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        html, body { height: auto; overflow: visible; }
        body { font-family: Arial, sans-serif; color: #1a1a1a; background: white; margin: 0; padding: 0; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Print controls — hidden on actual print/PDF output, this is the ONLY chrome on this page */}
      <div className="no-print" style={{ backgroundColor: '#1a1a2e', color: 'white', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 999, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px' }}>
          {docTypeLabel(baseDocType)}{withLetterhead ? ' — With Letterhead' : ' — Plain A4'}
        </span>
        <button onClick={() => window.print()} style={{ backgroundColor: '#2d6a4f', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
          🖨️ Print
        </button>
        <button onClick={handleDownload} disabled={downloading} style={{ backgroundColor: '#1d4ed8', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', opacity: downloading ? 0.7 : 1 }}>
          ⬇️ {downloading ? 'Preparing…' : 'Download PDF'}
        </button>
        <button onClick={() => window.close()} style={{ backgroundColor: '#666', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          ✕ Close
        </button>
      </div>

      {/* A4 document — the ONLY thing that ever gets printed/downloaded, no site UI is reachable
          from this route at all (see app/(print)/layout.jsx). position:relative anchors DocHeader's
          absolutely-positioned letterhead image to this box specifically (not the whole page). */}
      <div style={{ maxWidth: '210mm', margin: '0 auto', padding: `${CONTAINER_PADDING_MM}mm`, backgroundColor: 'white', minHeight: '297mm', position: 'relative' }}>
        {baseDocType === 'packing' && <PackingListDoc shipment={shipment} buyer={buyer} letterheadUrl={letterheadUrl} exporterInfo={exporterInfo} plain={!withLetterhead} onLetterheadLoad={triggerPrintWhenReady} />}
        {(baseDocType === 'buyer-invoice' || baseDocType === 'bd-invoice') && (
          <InvoiceDoc shipment={shipment} buyer={buyer} letterheadUrl={letterheadUrl} exporterInfo={exporterInfo} plain={!withLetterhead} type={baseDocType} onLetterheadLoad={triggerPrintWhenReady} />
        )}
      </div>
    </>
  );
}
