import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { hasPermission } from '@/lib/permissions';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType } from 'docx';

// Force dynamic rendering — this route reads live DB/session data on every request and
// must never be statically cached/prerendered (prevents both stale data and the
// DYNAMIC_SERVER_USAGE crash when headers()/cookies() are used via getServerSession).
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'customers', 'export')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const buyerType = searchParams.get('buyerType');

    const query = { role: { $in: ['localBuyer', 'internationalBuyer'] } };
    if (buyerType) query.buyerType = buyerType;

    const users = await User.find(query).sort('-createdAt').lean();

    if (format === 'json') {
      return NextResponse.json({ success: true, users });
    }

    const headers = ['Name', 'Email', 'Phone', 'Buyer Type', 'Country', 'Company', 'Registered'];
    const rows = users.map(u => [u.name, u.email, u.phone || '—', u.buyerType === 'local' ? 'Local' : 'International', u.country || '—', u.company || '—', new Date(u.createdAt).toLocaleDateString('en-GB')]);

    // ---------- CSV ----------
    if (format === 'csv') {
      const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="customers-${Date.now()}.csv"` } });
    }

    // ---------- Excel (XLSX) ----------
    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Customers');
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="customers-${Date.now()}.xlsx"` } });
    }

    // ---------- PDF ----------
    if (format === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      doc.setFillColor(45, 106, 79);
      doc.rect(0, 0, W, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('Shah International — Customer List', 14, 14);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Generated ${new Date().toLocaleString('en-GB')}  ·  ${users.length} customers`, W - 14, 14, { align: 'right' });

      autoTable(doc, {
        startY: 28,
        head: [headers],
        body: rows,
        headStyles: { fillColor: [45, 106, 79], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.5, cellPadding: 3 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 10, right: 10 },
      });

      const buffer = Buffer.from(doc.output('arraybuffer'));
      return new NextResponse(buffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="customers-${Date.now()}.pdf"` } });
    }

    // ---------- Word (DOCX) ----------
    if (format === 'doc' || format === 'docx') {
      const headerRow = new TableRow({
        children: headers.map(h => new TableCell({
          width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
          shading: { fill: '2D6A4F' },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 18 })] })],
        })),
      });
      const dataRows = rows.map((row, i) => new TableRow({
        children: row.map(cell => new TableCell({
          width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
          shading: i % 2 === 1 ? { fill: 'F3F4F6' } : undefined,
          children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 18 })] })],
        })),
      }));

      const doc = new Document({
        sections: [{
          properties: { page: { size: { orientation: 'landscape' } } },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Shah International', bold: true, color: '2D6A4F', size: 32 })] }),
            new Paragraph({ children: [new TextRun({ text: 'Customer List', bold: true, size: 26 })], spacing: { after: 100 } }),
            new Paragraph({ children: [new TextRun({ text: `Generated ${new Date().toLocaleString('en-GB')} · ${users.length} customers`, italics: true, size: 18, color: '6B7280' })], spacing: { after: 300 } }),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] }),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="customers-${Date.now()}.docx"` } });
    }

    return NextResponse.json({ success: false, message: 'Unsupported format' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
