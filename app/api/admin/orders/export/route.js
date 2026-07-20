import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import * as XLSX from 'xlsx';
import { hasPermission } from '@/lib/permissions';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!hasPermission(session, 'orders', 'view')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }
    await connectDB();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'xlsx';
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');
    const status = searchParams.get('status');

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo + 'T23:59:59');
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone company country buyerType')
      .sort('-createdAt')
      .limit(5000)
      .lean();

    if (format === 'csv') {
      const headers = ['Order #', 'Date', 'Customer', 'Email', 'Phone', 'Type', 'Items', 'Subtotal', 'Delivery', 'Discount', 'Total', 'Payment', 'Pay Status', 'Order Status', 'City', 'District'];
      const rows = orders.map(o => [
        o.orderNumber,
        new Date(o.createdAt).toLocaleDateString('en-GB'),
        o.user?.name || '',
        o.user?.email || '',
        o.user?.phone || '',
        o.orderType,
        o.items?.map(i => `${i.name}×${i.quantity}`).join('; '),
        o.subtotal,
        o.deliveryCharge,
        (o.discount || 0) + (o.couponDiscount || 0),
        o.total,
        o.paymentMethod,
        o.paymentStatus,
        o.status,
        o.deliveryAddress?.city || '',
        o.deliveryAddress?.district || '',
      ]);
      const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="orders-${Date.now()}.csv"` } });
    }

    // Excel format
    const ws_data = [
      ['Order #', 'Date', 'Customer Name', 'Email', 'Phone', 'Buyer Type', 'Items Count', 'Subtotal (BDT)', 'Delivery (BDT)', 'Discount (BDT)', 'Total (BDT)', 'Payment Method', 'Payment Status', 'Order Status', 'City', 'District', 'Coupon'],
      ...orders.map(o => [
        o.orderNumber,
        new Date(o.createdAt).toLocaleDateString('en-GB'),
        o.user?.name || '',
        o.user?.email || '',
        o.user?.phone || '',
        o.orderType,
        o.items?.length || 0,
        o.subtotal || 0,
        o.deliveryCharge || 0,
        (o.discount || 0) + (o.couponDiscount || 0),
        o.total || 0,
        o.paymentMethod || '',
        o.paymentStatus || '',
        o.status || '',
        o.deliveryAddress?.city || '',
        o.deliveryAddress?.district || '',
        o.couponCode || '',
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Style header row
    ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');

    // Summary sheet
    const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const delivered = orders.filter(o => o.status === 'delivered');
    const ws2_data = [
      ['Metric', 'Value'],
      ['Total Orders', orders.length],
      ['Delivered Orders', delivered.length],
      ['Total Revenue (BDT)', totalRevenue],
      ['Net Revenue (Delivered)', delivered.reduce((s, o) => s + o.total, 0)],
      ['Average Order Value', orders.length ? (totalRevenue / orders.length).toFixed(2) : 0],
      ['Total Discounts', orders.reduce((s, o) => s + (o.discount || 0) + (o.couponDiscount || 0), 0)],
      ['Local Orders', orders.filter(o => o.orderType === 'local').length],
      ['International Orders', orders.filter(o => o.orderType === 'international').length],
      ['Export Date', new Date().toLocaleDateString('en-GB')],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(ws2_data);
    ws2['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="orders-${Date.now()}.xlsx"` } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
