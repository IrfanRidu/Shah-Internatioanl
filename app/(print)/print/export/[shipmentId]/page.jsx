'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { generateShipmentDocPDF, docTypeLabel } from '@/lib/exportDocuments';
import { getDocumentColumns, shouldShowBdHsCode, columnHeaderLabel, avgPrice } from '@/lib/exportColumns';

// ─── Shared plain/formal styling — batch 7: the previous dark-header / colored-row / coded-banner
// look did not match the reference documents at all (Packing_List.pdf, Buyer_s_Invoice_.pdf,
// BD_Invoice.pdf — plain black text on white, thin black borders, no fill colors anywhere). Every
// style constant below intentionally has NO backgroundColor.
const TITLE_STYLE = { textAlign: 'center', fontSize: '14px', fontWeight: '700', marginBottom: '10px' };
const CELL = { padding: '4px 6px', borderRight: '1px solid #000', borderBottom: '1px solid #000', verticalAlign: 'top' };
const CELL_LAST = { padding: '4px 6px', borderBottom: '1px solid #000', verticalAlign: 'top' };
const TABLE_STYLE = { width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', border: '1px solid #000' };
const TH = { padding: '5px 4px', textAlign: 'center', border: '1px solid #000', fontWeight: 'bold' };
const TD = { padding: '4px', border: '1px solid #000' };
const TDC = { ...TD, textAlign: 'center' };
const SUMMARY_LINE = { fontSize: '10px', marginTop: '8px', padding: '5px 6px', border: '1px solid #000' };
const DECLARATION_STYLE = { fontSize: '9px', marginTop: '8px', lineHeight: '1.5', border: '1px solid #000', padding: '8px' };

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
function DocHeader({ letterheadUrl, exporterInfo, plain, onLetterheadLoad }) {
  // Issue 7: only trust the uploaded image as a full-width banner if it's actually banner-shaped
  // (wide) — a portrait/near-square upload would otherwise get squeezed to a barely-visible
  // thumbnail by maxHeight, checked once the image loads.
  const [imgIsBannerShaped, setImgIsBannerShaped] = useState(null); // null = not checked yet
  const checkShape = (e) => {
    const el = e.target;
    setImgIsBannerShaped(el.naturalWidth && el.naturalHeight ? (el.naturalWidth / el.naturalHeight) >= 2 : false);
    onLetterheadLoad?.(e);
  };
  // R2: "plain A4" must be exactly that — no banner or graphic of any kind above the title, per
  // the reference documents. No coded fallback here in plain mode, ever.
  if (plain) return null;
  const showImage = letterheadUrl && imgIsBannerShaped !== false;
  return (
    <div className="header">
      {showImage ? (
        <img
          src={letterheadUrl}
          alt="Letterhead"
          style={{ width: '100%', maxHeight: '130px', objectFit: 'contain', display: 'block', marginBottom: '16px', visibility: imgIsBannerShaped === null ? 'hidden' : 'visible', position: imgIsBannerShaped === null ? 'absolute' : 'static' }}
          onLoad={checkShape}
          onError={(e) => { setImgIsBannerShaped(false); onLetterheadLoad?.(e); }}
        />
      ) : null}
      {/* Coded fallback banner — letterhead MODE was selected, but no real letterhead has been
          uploaded yet (or it failed the banner-shape check). Never shown in plain mode (see the
          early return above). */}
      {(!letterheadUrl || imgIsBannerShaped === false) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#1a3d2e', borderRadius: '10px', padding: '16px 20px' }}>
          <div>
            <div style={{ fontSize: '26px', fontWeight: '700', fontStyle: 'italic', fontFamily: 'Georgia, "Times New Roman", serif', color: '#ffffff', lineHeight: 1.15 }}>{exporterInfo?.exporterName || 'Shah International'}</div>
          </div>
          <div style={{ fontSize: '10.5px', color: '#e9f2ee', textAlign: 'right', lineHeight: 1.6, maxWidth: '55%' }}>
            {exporterInfo?.exporterAddress}
          </div>
        </div>
      )}
    </div>
  );
}

// R1-R4: the header info block is the same on every document, always auto-filled from the
// shipment — used by Packing List, Buyer's Invoice, and BD Invoice alike.
function InfoGrid({ shipment, buyer, exporterInfo }) {
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
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

        <div style={CELL}><b>EXP :</b> {shipment.expNo} {shipment.expDate ? fmtDate(shipment.expDate) : ''}</div>
        <div style={CELL_LAST}><b>Final Destination :</b> {shipment.finalDestination}</div>

        <div style={CELL}><b>AWB :</b> {shipment.awbNo} {shipment.awbDate ? fmtDate(shipment.awbDate) : ''}</div>
        <div style={CELL_LAST}></div>

        <div style={{ ...CELL, borderBottom: shipment.beneficiaryBank ? '1px solid #000' : 'none' }}><b>PC :</b> {shipment.pcNo} {shipment.pcDate ? fmtDate(shipment.pcDate) : ''}</div>
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

function SignatureBlock({ exporterInfo }) {
  return (
    <div style={{ marginTop: '36px', textAlign: 'right', fontSize: '10px' }}>
      <div style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '4px', minWidth: '160px' }}>
        Proprietor<br />{exporterInfo?.exporterName || 'Shah International'}
      </div>
    </div>
  );
}

// R2: Packing List — SL/Name+Botanical always shown, plus whichever columns this shipment's Export
// Category enables (packSizeKg/totalCTN/quantityKg by default — the Fresh Fruits & Vegetables
// reference format).
function PackingListDoc({ shipment, buyer, letterheadUrl, exporterInfo, plain, onLetterheadLoad }) {
  const items = (shipment.items || []).filter((i) => i.productName);
  const grand = grandTotals(items);
  const columns = getDocumentColumns(shipment.exportCategory, 'packingList');

  return (
    <>
      <DocHeader letterheadUrl={letterheadUrl} exporterInfo={exporterInfo} plain={plain} onLetterheadLoad={onLetterheadLoad} />
      <h2 style={TITLE_STYLE}>Packing List</h2>
      <InfoGrid shipment={shipment} buyer={buyer} exporterInfo={exporterInfo} />

      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={TH}>SL NO.</th>
            <th style={{ ...TH, textAlign: 'left' }}>Name of Products<br />(Botanical Name)</th>
            {columns.map((k) => <th key={k} style={TH}>{columnHeaderLabel(k, shipment.baseCurrency)}</th>)}
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
        1. We hereby certify that the information on this invoice is true and correct and that contents of this shipment are as state above.<br />
        <b>Total Carton: {grand.totalCTN} CTN</b><br />
        <b>Net Weight: {shipment.totalNetWeightKg} KG</b><br />
        <b>Gross Weight: {shipment.totalGrossWeightKg} KG</b>
      </div>

      <SignatureBlock exporterInfo={exporterInfo} />
    </>
  );
}

// R3/R4: Buyer's Invoice and BD Invoice share this component (both headed "Commercial Invoice"),
// but differ in: item source (Buyer's Invoice mirrors the master `items`; BD Invoice uses its own
// small admin-editable `bdItems` — see the shipment editor), column set (registry key), H.S. Code
// placement (BD Invoice only, as a sub-line under the name, never its own column), and declaration
// text (Buyer's Invoice gets the full BDREX/GSP paragraph; BD Invoice gets the same simple one as
// Packing List).
function InvoiceDoc({ shipment, buyer, letterheadUrl, exporterInfo, plain, type, onLetterheadLoad }) {
  const isBuyer = type === 'buyer-invoice';
  const items = (isBuyer ? shipment.items : shipment.bdItems || []).filter((i) => i.productName);
  const currency = shipment.baseCurrency || 'EUR';
  const grand = grandTotals(items);
  const columns = getDocumentColumns(shipment.exportCategory, isBuyer ? 'buyerInvoice' : 'bdInvoice');
  const showBdHsCode = !isBuyer && shouldShowBdHsCode(shipment.exportCategory);

  return (
    <>
      <DocHeader letterheadUrl={letterheadUrl} exporterInfo={exporterInfo} plain={plain} onLetterheadLoad={onLetterheadLoad} />
      <h2 style={TITLE_STYLE}>Commercial Invoice</h2>
      <InfoGrid shipment={shipment} buyer={buyer} exporterInfo={exporterInfo} />

      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={TH}>SL NO.</th>
            <th style={{ ...TH, textAlign: 'left' }}>Name of Products<br />(Botanical Name)</th>
            {columns.map((k) => <th key={k} style={TH}>{columnHeaderLabel(k, currency)}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={TDC}>{i + 1}</td>
              <td style={TD}>
                {item.productName}
                {item.botanicalName && <><br /><span style={{ fontStyle: 'italic', fontSize: '8.5px' }}>({item.botanicalName})</span></>}
                {showBdHsCode && item.hsCode && <><br /><span style={{ fontSize: '8.5px' }}>H.S Code : {item.hsCode}</span></>}
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
        {isBuyer ? (
          <>
            THE EXPORTER {(exporterInfo.exporterName || 'SHAH INTERNATIONAL').toUpperCase()}. BDREX{shipment.rexNo || ''} OF THE PRODUCTS COVERED BY THIS DOCUMENTS DECLARES THAT, EXCEPT WHERE OTHERWISE CLEARLY INDICATED. THESE PRODUCTS ARE OF BANGLADESH PREFERENTIAL ORIGIN (5) ACCORDING TO RULES OF THE GENERALIZED SYSTEM OF PREFERENCES OF THE EUROPEAN UNION AND THAT THE ORIGIN CRITERION MET IS W 0709,0714,0710, 0810 (07119000)1. We hereby certify that the information on this invoice is true and correct and that contents of this shipment are as state above.<br />
          </>
        ) : (
          <>1. We hereby certify that the information on this invoice is true and correct and that contents of this shipment are as state above.<br /></>
        )}
        <b>Total Carton: {grand.totalCTN} CTN</b><br />
        <b>Net Weight: {shipment.totalNetWeightKg} KG</b><br />
        <b>Gross Weight: {shipment.totalGrossWeightKg} KG</b>
      </div>

      <SignatureBlock exporterInfo={exporterInfo} />
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
          from this route at all (see app/(print)/layout.jsx) */}
      <div style={{ maxWidth: '210mm', margin: '0 auto', padding: '12mm', backgroundColor: 'white', minHeight: '297mm' }}>
        {baseDocType === 'packing' && <PackingListDoc shipment={shipment} buyer={buyer} letterheadUrl={letterheadUrl} exporterInfo={exporterInfo} plain={!withLetterhead} onLetterheadLoad={triggerPrintWhenReady} />}
        {(baseDocType === 'buyer-invoice' || baseDocType === 'bd-invoice') && (
          <InvoiceDoc shipment={shipment} buyer={buyer} letterheadUrl={letterheadUrl} exporterInfo={exporterInfo} plain={!withLetterhead} type={baseDocType} onLetterheadLoad={triggerPrintWhenReady} />
        )}
      </div>
    </>
  );
}
