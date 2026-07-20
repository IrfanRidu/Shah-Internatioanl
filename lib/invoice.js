import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateOrderInvoicePDF(order, settings = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const BRAND = [45, 106, 79];
  const LIGHT = [240, 253, 244];
  const GRAY = [107, 114, 128];
  const DARK = [17, 24, 39];

  // Header background
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 42, 'F');

  // Logo area
  doc.setFillColor(255, 255, 255, 30);
  doc.roundedRect(10, 8, 28, 28, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SI', 24, 26, { align: 'center' });

  // Company name
  doc.setFontSize(16);
  doc.text('Shah International', 44, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Farm Fresh. Global Reach.', 44, 24);
  doc.setFontSize(8);
  doc.text('export@shahintl.com  |  +880 1700-000000  |  Dhaka, Bangladesh', 44, 30);

  // Invoice label
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', W - 14, 22, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${order.orderNumber}`, W - 14, 30, { align: 'right' });

  // Info boxes
  doc.setFillColor(...LIGHT);
  doc.roundedRect(10, 48, 90, 36, 3, 3, 'F');
  doc.roundedRect(110, 48, 90, 36, 3, 3, 'F');

  const labelStyle = () => { doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY); };
  const valueStyle = () => { doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK); };

  // Billing info
  labelStyle(); doc.text('BILL TO', 14, 55);
  valueStyle(); doc.text(order.deliveryAddress?.name || order.user?.name || '—', 14, 61);
  labelStyle(); doc.text(order.user?.email || '—', 14, 66);
  doc.text(order.user?.phone || '—', 14, 71);
  doc.text(order.deliveryAddress?.city ? `${order.deliveryAddress.city}, Bangladesh` : 'Bangladesh', 14, 76);

  // Order info
  labelStyle(); doc.text('ORDER DETAILS', 114, 55);
  const fields = [
    ['Order #', order.orderNumber],
    ['Date', new Date(order.createdAt).toLocaleDateString('en-GB')],
    ['Payment', (order.paymentMethod || '—').replace('_', ' ').toUpperCase()],
    ['Status', order.status?.toUpperCase()],
  ];
  fields.forEach(([k, v], i) => {
    labelStyle(); doc.text(k, 114, 61 + i * 5);
    valueStyle(); doc.text(String(v), 165, 61 + i * 5, { align: 'right' });
  });

  // Items table
  const tableBody = order.items.map(item => [
    item.name,
    `${item.quantity} ${item.unit || 'kg'}`,
    `BDT ${item.price?.toLocaleString()}`,
    `BDT ${(item.price * item.quantity)?.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: 92,
    head: [['Product / Description', 'Quantity', 'Unit Price', 'Total']],
    body: tableBody,
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 4 },
    bodyStyles: { fontSize: 9, cellPadding: 4, textColor: DARK },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 28, halign: 'center' }, 2: { cellWidth: 38, halign: 'right' }, 3: { cellWidth: 38, halign: 'right' } },
    margin: { left: 10, right: 10 },
    tableLineColor: [229, 231, 235],
    tableLineWidth: 0.3,
  });

  const finalY = doc.lastAutoTable.finalY + 6;

  // Totals block
  const totalsX = W - 70;
  const rows = [
    ['Subtotal', `BDT ${order.subtotal?.toLocaleString()}`],
    ...(order.deliveryCharge > 0 ? [['Delivery Charge', `BDT ${order.deliveryCharge}`]] : [['Delivery', 'FREE']]),
    ...(order.couponDiscount > 0 ? [[`Coupon (${order.couponCode})`, `-BDT ${order.couponDiscount}`]] : []),
  ];
  rows.forEach(([label, value], i) => {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
    doc.text(label, totalsX, finalY + i * 6);
    doc.setTextColor(...DARK); doc.text(value, W - 12, finalY + i * 6, { align: 'right' });
  });

  const totalY = finalY + rows.length * 6 + 4;
  doc.setFillColor(...BRAND);
  doc.roundedRect(totalsX - 4, totalY - 5, W - totalsX - 4, 12, 2, 2, 'F');
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', totalsX, totalY + 3);
  doc.text(`BDT ${order.total?.toLocaleString()}`, W - 12, totalY + 3, { align: 'right' });

  // Payment status badge
  const paidY = totalY + 16;
  if (order.paymentStatus === 'paid') {
    doc.setFillColor(220, 252, 231); doc.roundedRect(10, paidY, 40, 10, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(21, 128, 61);
    doc.text('✓ PAID', 30, paidY + 6.5, { align: 'center' });
  } else if (order.paymentMethod === 'cod') {
    doc.setFillColor(254, 243, 199); doc.roundedRect(10, paidY, 50, 10, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 83, 9);
    doc.text('CASH ON DELIVERY', 35, paidY + 6.5, { align: 'center' });
  }

  // Notes
  if (order.customerNote) {
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...GRAY);
    doc.text(`Note: ${order.customerNote}`, 10, paidY + 18);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 18;
  doc.setFillColor(249, 250, 251);
  doc.rect(0, footerY - 4, W, 22, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
  doc.text('Thank you for choosing Shah International!', W / 2, footerY + 2, { align: 'center' });
  doc.text('For queries: export@shahintl.com  |  +880 1700-000000  |  wa.me/8801700000000', W / 2, footerY + 7, { align: 'center' });
  doc.setFontSize(7);
  doc.text(`Generated on ${new Date().toLocaleString('en-GB')}  |  Shah International, Dhaka, Bangladesh`, W / 2, footerY + 13, { align: 'center' });

  return doc;
}
