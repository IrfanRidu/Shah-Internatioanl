'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

// Shared header for all documents
function DocHeader({ shipment, buyer, country, letterheadUrl, title }) {
  const EXPORTER = {
    name: 'Shah International',
    address: '111 South Bashabo, Opposite of Sabujbagh Thana, Dhaka 1214',
    phone: '01681-896498',
    email: 'shahinternational@gmail.com',
    web: 'www.shahinternational.com',
  };

  return (
    <div className="header">
      {letterheadUrl ? (
        <img src={letterheadUrl} alt="Letterhead" style={{ width: '100%', maxHeight: '130px', objectFit: 'contain', display: 'block', marginBottom: '16px' }} />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '2px solid #2d6a4f', paddingBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#2d6a4f' }}>{EXPORTER.name}</div>
            <div style={{ fontSize: '11px', color: '#555' }}>{EXPORTER.address}</div>
          </div>
          <div style={{ fontSize: '10px', color: '#555', textAlign: 'right' }}>
            <div>📞 {EXPORTER.phone}</div>
            <div>✉ {EXPORTER.email}</div>
            <div>🌐 {EXPORTER.web}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function PackingListDoc({ shipment, buyer, country, letterheadUrl }) {
  const items = (shipment.items || []).filter(i => i.productName);
  const totalCTN = items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const totalQty = items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);

  return (
    <>
      <DocHeader shipment={shipment} buyer={buyer} country={country} letterheadUrl={letterheadUrl} title="Packing List" />
      <h2 style={{ textAlign: 'center', fontSize: '14px', fontWeight: '700', marginBottom: '12px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>Packing List</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px', marginBottom: '12px' }}>
        <div><b>Exporter:</b> Shah International, 111 South Bashabo, Opposite of Sabujbagh Thana</div>
        <div><b>Country of Origin:</b> {shipment.countryOfOrigin || 'Bangladesh'}</div>
        <div><b>Contract No:</b> {shipment.contractNo}</div>
        <div><b>Importer:</b> {buyer?.name}, {buyer?.address}</div>
        <div><b>TIN:</b> {shipment.tinNo} &nbsp;&nbsp; <b>BIN:</b> {shipment.binNo}</div>
        <div><b>Sales Term:</b> {shipment.salesTerm}</div>
        <div><b>ERC:</b> {shipment.ercNo}</div>
        <div><b>Mode of Carrying:</b> {shipment.modeOfCarrying}</div>
        <div><b>EXP No:</b> {shipment.expNo} &nbsp;&nbsp; {shipment.dateStr && new Date(shipment.date).toLocaleDateString('en-GB')}</div>
        <div><b>Landing Port:</b> {shipment.landingPort}</div>
        <div><b>AWB:</b> {shipment.awbNo}</div>
        <div><b>Port of Discharge:</b> {shipment.portOfDischarge}</div>
        <div><b>PC:</b> {shipment.pcNo}</div>
        <div><b>Final Destination:</b> {shipment.finalDestination}</div>
      </div>

      {shipment.beneficiaryBank && (
        <div style={{ fontSize: '9px', marginBottom: '10px', backgroundColor: '#f9f9f9', padding: '6px', borderRadius: '4px' }}>
          <b>Beneficiary Bank:</b> {shipment.beneficiaryBank} &nbsp;|&nbsp; Acc: {shipment.accountNo} &nbsp;|&nbsp; {shipment.branchName} &nbsp;|&nbsp; Routing: {shipment.routingNo} &nbsp;|&nbsp; SWIFT: {shipment.swiftCode}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
            <th style={{ padding: '5px 4px', textAlign: 'center', border: '1px solid #333' }}>SL No.</th>
            <th style={{ padding: '5px 4px', textAlign: 'left', border: '1px solid #333' }}>Name of Products</th>
            <th style={{ padding: '5px 4px', textAlign: 'left', border: '1px solid #333' }}>Botanical Name</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', border: '1px solid #333' }}>Pack Size in KG</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', border: '1px solid #333' }}>Total CTN</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', border: '1px solid #333' }}>Quantity KG</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8f9fa', border: '1px solid #ddd' }}>
              <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{i + 1}</td>
              <td style={{ padding: '4px', border: '1px solid #ddd' }}>{item.productName}</td>
              <td style={{ padding: '4px', fontStyle: 'italic', border: '1px solid #ddd' }}>{item.botanicalName}</td>
              <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{item.packSizeKg}</td>
              <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{item.totalCTN}</td>
              <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{item.quantityKg}</td>
            </tr>
          ))}
          <tr style={{ backgroundColor: '#e8f5e9', fontWeight: 'bold' }}>
            <td colSpan={4} style={{ padding: '5px', textAlign: 'right', border: '1px solid #ccc' }}>Grand Total:</td>
            <td style={{ padding: '5px', textAlign: 'center', border: '1px solid #ccc' }}>{totalCTN}</td>
            <td style={{ padding: '5px', textAlign: 'center', border: '1px solid #ccc' }}>{totalQty.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: '10px', marginTop: '10px', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
        <b>Gross Weight: {shipment.totalGrossWeightKg} KG &nbsp;&nbsp; Freight Cost: {shipment.freightCost}</b>
      </div>

      <div style={{ fontSize: '9px', marginTop: '10px', lineHeight: '1.5' }}>
        1. We hereby certify that the information on this invoice is true and correct and that the contents of this shipment are as state above.<br />
        <b>Total Carton: {totalCTN} CTN &nbsp;&nbsp; Net Weight: {shipment.totalNetWeightKg} KG &nbsp;&nbsp; Gross Weight: {shipment.totalGrossWeightKg} KG</b>
      </div>

      <div style={{ marginTop: '40px', textAlign: 'right', fontSize: '10px' }}>
        <div style={{ borderTop: '1px solid #333', display: 'inline-block', paddingTop: '4px', minWidth: '160px' }}>
          Proprietor<br />Shah International
        </div>
      </div>
    </>
  );
}

function InvoiceDoc({ shipment, buyer, country, letterheadUrl, type }) {
  const isBuyer = type === 'buyer-invoice';
  const items = (isBuyer ? shipment.buyerItems : shipment.bdItems || []).filter(i => i.productName);
  const currency = shipment.baseCurrency || 'EUR';
  const totalCTN = items.reduce((a, r) => a + (Number(r.totalCTN) || 0), 0);
  const totalQty = items.reduce((a, r) => a + (Number(r.quantityKg) || 0), 0);
  const totalValue = items.reduce((a, r) => a + (Number(r.totalValue) || 0), 0);

  return (
    <>
      <DocHeader shipment={shipment} buyer={buyer} country={country} letterheadUrl={letterheadUrl} />
      <h2 style={{ textAlign: 'center', fontSize: '14px', fontWeight: '700', marginBottom: '12px', borderBottom: '1px solid #ccc', paddingBottom: '8px' }}>
        {isBuyer ? 'Commercial Invoice' : 'Bangladeshi Invoice'}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px', marginBottom: '12px' }}>
        <div><b>Exporter:</b> Shah International<br />111 South Bashabo, Opposite of Sabujbagh Thana</div>
        <div><b>Country of Origin:</b> {shipment.countryOfOrigin || 'Bangladesh'}<br /><b>Sales Term:</b> {shipment.salesTerm}</div>
        <div><b>Contract No:</b> {shipment.contractNo} &nbsp;&nbsp; <b>Invoice No:</b> {shipment.invoiceNo}</div>
        <div><b>Importer:</b> {buyer?.name}<br />{buyer?.address}</div>
        <div><b>TIN:</b> {shipment.tinNo} &nbsp;&nbsp; <b>BIN:</b> {shipment.binNo}</div>
        <div><b>Mode of Carrying:</b> {shipment.modeOfCarrying}</div>
        <div><b>ERC:</b> {shipment.ercNo} &nbsp;&nbsp; <b>EXP:</b> {shipment.expNo}</div>
        <div><b>Landing Port:</b> {shipment.landingPort}</div>
        <div><b>AWB:</b> {shipment.awbNo} &nbsp;&nbsp; <b>PC:</b> {shipment.pcNo}</div>
        <div><b>Port of Discharge:</b> {shipment.portOfDischarge}<br /><b>Final Destination:</b> {shipment.finalDestination}</div>
      </div>

      {shipment.beneficiaryBank && (
        <div style={{ fontSize: '9px', marginBottom: '10px', backgroundColor: '#f9f9f9', padding: '6px' }}>
          <b>Beneficiary Bank:</b> {shipment.beneficiaryBank} &nbsp;|&nbsp; Acc: {shipment.accountNo} &nbsp;|&nbsp;
          {shipment.branchName} &nbsp;|&nbsp; Routing: {shipment.routingNo} &nbsp;|&nbsp; SWIFT: {shipment.swiftCode}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
            <th style={{ padding: '5px 4px', textAlign: 'center', border: '1px solid #333', width: '30px' }}>SL</th>
            <th style={{ padding: '5px 4px', textAlign: 'left', border: '1px solid #333' }}>Name of Products (Botanical Name)</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', border: '1px solid #333' }}>Total CTN</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', border: '1px solid #333' }}>Qty KG</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', border: '1px solid #333' }}>Unit Price</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', border: '1px solid #333' }}>Total {currency} (CFR)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8f9fa' }}>
              <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{i + 1}</td>
              <td style={{ padding: '4px', border: '1px solid #ddd' }}>
                {item.productName}<br />
                {item.botanicalName && <span style={{ fontStyle: 'italic', fontSize: '9px', color: '#555' }}>({item.botanicalName})</span>}
              </td>
              <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{item.totalCTN}</td>
              <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{item.quantityKg}</td>
              <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{Number(item.unitPrice).toFixed(2)}</td>
              <td style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontWeight: 'bold' }}>{Number(item.totalValue).toFixed(2)}{currency}</td>
            </tr>
          ))}
          <tr style={{ backgroundColor: '#e8f5e9', fontWeight: 'bold' }}>
            <td colSpan={2} style={{ padding: '5px', textAlign: 'right', border: '1px solid #ccc' }}>Grand Total:</td>
            <td style={{ padding: '5px', textAlign: 'center', border: '1px solid #ccc' }}>{totalCTN}</td>
            <td style={{ padding: '5px', textAlign: 'center', border: '1px solid #ccc' }}>{totalQty.toFixed(1)}</td>
            <td style={{ border: '1px solid #ccc' }}></td>
            <td style={{ padding: '5px', textAlign: 'right', border: '1px solid #ccc', color: '#2d6a4f' }}>{totalValue.toFixed(2)}{currency}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: '9px', marginTop: '10px', lineHeight: '1.7', backgroundColor: '#f5f5f5', padding: '8px' }}>
        <b>Gross Weight: {shipment.totalGrossWeightKg} KG &nbsp;&nbsp; Freight Cost: {shipment.freightCost}</b><br />
        THE EXPORTER SHAH INTERNATIONAL. BDREX04343 OF THE PRODUCTS COVERED BY THIS DOCUMENTS DECLARES THAT, EXCEPT WHERE OTHERWISE CLEARLY INDICATED. THESE PRODUCTS ARE OF BANGLADESH PREFERENTIAL ORIGIN (5) ACCORDING TO RULES OF THE GENERALIZED SYSTEM OF PREFERENCES OF THE EUROPEAN UNION AND THAT THE ORIGIN CRITERION MET IS W 0709,0714,0710, 0810 (07119000)1. We hereby certify that the information on this Invoice is true and correct and that contents of this shipment are as state above.<br />
        <b>Total Carton: {totalCTN} CTN &nbsp; Net Weight: {shipment.totalNetWeightKg} KG &nbsp; Gross Weight: {shipment.totalGrossWeightKg} KGS</b>
      </div>

      <div style={{ marginTop: '40px', textAlign: 'right', fontSize: '10px' }}>
        <div style={{ borderTop: '1px solid #333', display: 'inline-block', paddingTop: '4px', minWidth: '160px' }}>
          Proprietor<br />Shah International
        </div>
      </div>
    </>
  );
}

export default function PrintPage() {
  const { shipmentId } = useParams();
  const searchParams = useSearchParams();
  const docType = searchParams.get('doc') || 'packing-plain';
  const letterheadParam = searchParams.get('letterhead') || '';
  const [shipment, setShipment] = useState(null);
  const [buyer, setBuyer] = useState(null);
  const [country, setCountry] = useState(null);
  const [loading, setLoading] = useState(true);

  const withLetterhead = docType.includes('letterhead');
  const letterheadUrl = withLetterhead ? letterheadParam : '';
  const baseDocType = docType.replace('-letterhead', '').replace('-plain', '');

  useEffect(() => {
    fetch(`/api/export/shipments/${shipmentId}`).then(r => r.json()).then(d => {
      setShipment(d.shipment);
      setBuyer(d.shipment?.buyer);
      setCountry(d.shipment?.country);
      setLoading(false);
    });
  }, [shipmentId]);

  useEffect(() => {
    if (!loading && shipment) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, shipment]);

  if (loading) return <div style={{ fontFamily: 'Arial, sans-serif', padding: '40px', textAlign: 'center' }}>Loading document...</div>;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 15mm 12mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, sans-serif; color: #1a1a1a; background: white; margin: 0; padding: 0; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Print controls — hidden on actual print */}
      <div className="no-print" style={{ backgroundColor: '#1a1a2e', color: 'white', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 999 }}>
        <span style={{ fontSize: '13px' }}>
          {baseDocType === 'packing' ? '📦 Packing List' : baseDocType === 'buyer-invoice' ? "🧾 Buyer's Invoice" : '🇧🇩 BD Invoice'}
          {withLetterhead ? ' — With Letterhead' : ' — Plain A4'}
        </span>
        <button onClick={() => window.print()} style={{ backgroundColor: '#2d6a4f', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
          🖨️ Print / Save as PDF
        </button>
        <button onClick={() => window.close()} style={{ backgroundColor: '#666', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
          ✕ Close
        </button>
      </div>

      {/* A4 document */}
      <div style={{ maxWidth: '210mm', margin: '0 auto', padding: '12mm', backgroundColor: 'white', minHeight: '297mm' }}>
        {baseDocType === 'packing' && <PackingListDoc shipment={shipment} buyer={buyer} country={country} letterheadUrl={letterheadUrl} />}
        {(baseDocType === 'buyer-invoice' || baseDocType === 'bd-invoice') && (
          <InvoiceDoc shipment={shipment} buyer={buyer} country={country} letterheadUrl={letterheadUrl} type={baseDocType} />
        )}
      </div>
    </>
  );
}
