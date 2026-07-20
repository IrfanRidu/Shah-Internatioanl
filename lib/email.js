import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

const FROM = process.env.EMAIL_FROM || 'Shah International <noreply@shahintl.com>';
const BRAND_COLOR = '#2d6a4f';
const SITE_URL = process.env.NEXTAUTH_URL || 'https://shahintl.com';

const baseTemplate = (content) => `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Inter,-apple-system,sans-serif;background:#f0fdf4;margin:0;padding:20px}
.container{max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.header{background:linear-gradient(135deg,#052e16,#166534);padding:32px;text-align:center}
.header h1{color:white;font-size:24px;margin:0;font-weight:700}
.header p{color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:14px}
.body{padding:32px}.section{margin-bottom:24px}
h2{color:#1a1a1a;font-size:20px;margin:0 0 16px;font-weight:700}
p{color:#4b5563;font-size:15px;line-height:1.7;margin:0 0 12px}
.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.badge-green{background:#dcfce7;color:#15803d}
.badge-amber{background:#fef3c7;color:#b45309}
.badge-blue{background:#dbeafe;color:#1d4ed8}
.badge-red{background:#fee2e2;color:#dc2626}
table{width:100%;border-collapse:collapse;margin:16px 0}
th{background:#f9fafb;padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e5e7eb}
td{padding:12px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151}
.total-row td{font-weight:700;font-size:16px;color:#111827;border-bottom:none}
.btn{display:inline-block;background:#2d6a4f;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;margin:8px 4px}
.btn-outline{background:transparent;color:#2d6a4f;border:2px solid #2d6a4f}
.footer{background:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb}
.footer p{color:#9ca3af;font-size:12px;margin:4px 0}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
.info-box{background:#f9fafb;border-radius:10px;padding:14px}
.info-box .label{font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;margin-bottom:4px}
.info-box .value{font-size:14px;color:#111827;font-weight:500}
.status-track{display:flex;align-items:center;gap:0;margin:20px 0}
.step{flex:1;text-align:center;position:relative}
.step-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;font-size:12px;font-weight:700}
.step-done{background:#2d6a4f;color:white}
.step-active{background:#dcfce7;color:#2d6a4f;border:2px solid #2d6a4f}
.step-todo{background:#f3f4f6;color:#9ca3af}
.step-label{font-size:11px;color:#6b7280}
.step-line{height:2px;background:#e5e7eb;position:absolute;top:16px;left:50%;right:-50%;z-index:-1}
.step-line-done{background:#2d6a4f}
</style></head><body><div class="container">${content}
<div class="footer">
<p>🌿 <strong>Shah International</strong> – Farm Fresh. Global Reach.</p>
<p>Dhaka, Bangladesh · <a href="mailto:info@shahintl.com" style="color:#2d6a4f">info@shahintl.com</a> · <a href="https://wa.me/8801700000000" style="color:#2d6a4f">WhatsApp</a></p>
<p style="margin-top:8px;font-size:11px">© ${new Date().getFullYear()} Shah International. All rights reserved.</p>
</div></div></body></html>`;

const STATUS_BADGE = { pending: 'badge-amber', confirmed: 'badge-blue', processing: 'badge-blue', onTheWay: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red', returned: 'badge-red' };
const STATUS_MSG = {
  confirmed: 'Your order has been confirmed and is being prepared.',
  processing: 'Your order is being carefully packed and will be dispatched soon.',
  onTheWay: 'Great news! Your order is on the way. Our delivery partner will contact you.',
  delivered: 'Your order has been delivered. We hope you enjoy your fresh produce!',
  cancelled: 'Your order has been cancelled. If you paid online, a refund will be processed.',
};

export const sendEmail = async ({ to, subject, html }) => {
  return transporter.sendMail({ from: FROM, to, subject, html });
};

export const sendOrderConfirmation = async (order, user) => {
  const itemsHtml = order.items.map(i =>
    `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity} ${i.unit || 'kg'}</td><td style="text-align:right">৳${(i.price * i.quantity).toLocaleString()}</td></tr>`
  ).join('');
  const html = baseTemplate(`
<div class="header"><h1>✅ Order Confirmed!</h1><p>Order #${order.orderNumber}</p></div>
<div class="body">
<h2>Hello ${user.name}! 👋</h2>
<p>Thank you for your order from Shah International. We've received your order and it's being prepared with care.</p>
<div class="info-grid">
  <div class="info-box"><div class="label">Order Number</div><div class="value">#${order.orderNumber}</div></div>
  <div class="info-box"><div class="label">Payment Method</div><div class="value" style="text-transform:capitalize">${order.paymentMethod?.replace('_', ' ')}</div></div>
  <div class="info-box"><div class="label">Delivery To</div><div class="value">${order.deliveryAddress?.name || user.name}</div></div>
  <div class="info-box"><div class="label">Total Amount</div><div class="value" style="color:#2d6a4f;font-weight:700">৳${order.total?.toLocaleString()}</div></div>
</div>
<h2>Your Items</h2>
<table><thead><tr><th>Product</th><th>Qty</th><th style="text-align:right">Price</th></tr></thead>
<tbody>${itemsHtml}</tbody>
<tfoot>
${order.deliveryCharge > 0 ? `<tr><td colspan="2">Delivery Charge</td><td style="text-align:right">৳${order.deliveryCharge}</td></tr>` : ''}
${order.couponDiscount > 0 ? `<tr style="color:#2d6a4f"><td colspan="2">Coupon Discount</td><td style="text-align:right">-৳${order.couponDiscount}</td></tr>` : ''}
<tr class="total-row"><td colspan="2">Total</td><td style="text-align:right;color:#2d6a4f">৳${order.total?.toLocaleString()}</td></tr>
</tfoot></table>
<div style="text-align:center;margin-top:24px">
<a href="${SITE_URL}/orders/${order._id}" class="btn">Track Your Order →</a>
<a href="https://wa.me/8801700000000" class="btn btn-outline">💬 WhatsApp Us</a>
</div></div>`);
  return sendEmail({ to: user.email, subject: `✅ Order Confirmed – #${order.orderNumber} | Shah International`, html });
};

export const sendOrderStatusEmail = async (order, user, status) => {
  const msg = STATUS_MSG[status] || `Your order status has been updated to: ${status}.`;
  const STEPS = ['confirmed', 'processing', 'onTheWay', 'delivered'];
  const currentIdx = STEPS.indexOf(status);
  const stepsHtml = STEPS.map((s, i) => {
    const cls = i < currentIdx ? 'step-done' : i === currentIdx ? 'step-active' : 'step-todo';
    const labels = { confirmed: 'Confirmed', processing: 'Processing', onTheWay: 'On the Way', delivered: 'Delivered' };
    const icons = { confirmed: '✓', processing: '⚙', onTheWay: '🚚', delivered: '✔' };
    return `<div class="step"><div class="step-dot ${cls}">${icons[s]}</div><div class="step-label">${labels[s]}</div>${i < 3 ? `<div class="step-line ${i < currentIdx ? 'step-line-done' : ''}"></div>` : ''}</div>`;
  }).join('');
  const statusEmojis = { confirmed: '✅', processing: '⚙️', onTheWay: '🚚', delivered: '🎉', cancelled: '❌' };
  const html = baseTemplate(`
<div class="header"><h1>${statusEmojis[status] || '📦'} Order ${status.charAt(0).toUpperCase() + status.slice(1)}</h1><p>Order #${order.orderNumber}</p></div>
<div class="body">
<h2>Hi ${user.name},</h2>
<p>${msg}</p>
${!['cancelled','returned'].includes(status) ? `<div class="status-track">${stepsHtml}</div>` : ''}
<div class="info-grid">
  <div class="info-box"><div class="label">Order</div><div class="value">#${order.orderNumber}</div></div>
  <div class="info-box"><div class="label">Total</div><div class="value" style="color:#2d6a4f">৳${order.total?.toLocaleString()}</div></div>
</div>
<div style="text-align:center;margin-top:24px">
<a href="${SITE_URL}/orders/${order._id}" class="btn">View Order Details</a>
</div>
${status === 'delivered' ? '<p style="text-align:center;margin-top:16px;color:#6b7280">Enjoying our products? We\'d love your feedback!</p>' : ''}
</div>`);
  const subjects = { confirmed: '✅ Order Confirmed', processing: '⚙️ Order Being Prepared', onTheWay: '🚚 Order is On the Way!', delivered: '🎉 Order Delivered!', cancelled: '❌ Order Cancelled' };
  return sendEmail({ to: user.email, subject: `${subjects[status] || 'Order Update'} – #${order.orderNumber} | Shah International`, html });
};

export const sendWelcomeEmail = async (user) => {
  const html = baseTemplate(`
<div class="header"><h1>🌿 Welcome to Shah International!</h1><p>Farm Fresh. Global Reach.</p></div>
<div class="body">
<h2>Hello ${user.name}! 👋</h2>
<p>Welcome aboard! Your account has been created as a <strong>${user.buyerType === 'local' ? '🇧🇩 Local Buyer' : '🌍 International Buyer / Importer'}</strong>.</p>
${user.buyerType === 'local' ? `
<p>You can now:</p>
<ul style="color:#4b5563;line-height:2">
<li>Browse 100+ fresh seasonal products</li>
<li>Get home delivery across Bangladesh</li>
<li>Pay with bKash, Nagad, Card, or Cash on Delivery</li>
<li>Use coupon code <strong style="color:#2d6a4f">WELCOME10</strong> for 10% off your first order!</li>
</ul>` : `
<p>As an international buyer, you can:</p>
<ul style="color:#4b5563;line-height:2">
<li>Browse bulk pricing for 100+ agricultural products</li>
<li>Request export quotations directly</li>
<li>Contact our team via WhatsApp for fast response</li>
<li>Access phytosanitary certificates and compliance docs</li>
</ul>`}
<div style="text-align:center;margin-top:28px">
<a href="${SITE_URL}/products" class="btn">Start Exploring →</a>
</div></div>`);
  return sendEmail({ to: user.email, subject: `🌿 Welcome to Shah International, ${user.name}!`, html });
};

export const sendQuotationEmail = async ({ to, name, company, product, quantity, message, phone, country }) => {
  const adminHtml = baseTemplate(`
<div class="header"><h1>📋 New Import Quotation</h1><p>Action Required</p></div>
<div class="body">
<h2>New Quotation Request</h2>
<div class="info-grid">
  <div class="info-box"><div class="label">Name</div><div class="value">${name}</div></div>
  <div class="info-box"><div class="label">Company</div><div class="value">${company || '—'}</div></div>
  <div class="info-box"><div class="label">Email</div><div class="value">${to}</div></div>
  <div class="info-box"><div class="label">Phone/WhatsApp</div><div class="value">${phone || '—'}</div></div>
  <div class="info-box"><div class="label">Country</div><div class="value">${country || '—'}</div></div>
  <div class="info-box"><div class="label">Product</div><div class="value">${product}</div></div>
</div>
<div class="info-box" style="margin-top:12px"><div class="label">Quantity Required</div><div class="value">${quantity}</div></div>
${message ? `<div class="info-box" style="margin-top:12px"><div class="label">Additional Requirements</div><div class="value">${message}</div></div>` : ''}
<div style="text-align:center;margin-top:24px">
<a href="mailto:${to}" class="btn">Reply via Email</a>
<a href="https://wa.me/${(phone || '').replace(/[^0-9]/g, '')}" class="btn btn-outline">WhatsApp</a>
</div></div>`);
  await sendEmail({ to: process.env.SMTP_USER, subject: `📋 Quotation: ${product} – ${name} (${country || ''})`, html: adminHtml });

  const buyerHtml = baseTemplate(`
<div class="header"><h1>📋 Quotation Request Received</h1><p>We'll respond within 24 hours</p></div>
<div class="body">
<h2>Hello ${name},</h2>
<p>Thank you for your interest in importing <strong>${product}</strong> from Shah International. We have received your quotation request and our export team will review it promptly.</p>
<div class="info-box" style="margin:20px 0"><div class="label">Your Request Summary</div><div class="value">${product} – ${quantity}</div></div>
<p>Our team typically responds within <strong>24 business hours</strong>. For urgent inquiries, please reach us directly:</p>
<div style="text-align:center;margin:24px 0">
<a href="https://wa.me/8801700000000" class="btn">💬 WhatsApp Now</a>
<a href="mailto:export@shahintl.com" class="btn btn-outline">✉ Email Export Team</a>
</div></div>`);
  return sendEmail({ to, subject: `📋 Quotation Request Received – ${product} | Shah International`, html: buyerHtml });
};

export const sendLowStockAlert = async (items) => {
  const rows = items.map(i => `<tr><td>${i.product?.name}</td><td style="color:#dc2626;font-weight:700">${i.currentStock} ${i.product?.unit}</td><td>${i.minimumStockAlert}</td></tr>`).join('');
  const html = baseTemplate(`
<div class="header"><h1>⚠️ Low Stock Alert</h1><p>Action required – ${items.length} products need restocking</p></div>
<div class="body">
<h2>Inventory Alert</h2>
<p>${items.length} product(s) have fallen below their minimum stock threshold and require immediate attention.</p>
<table><thead><tr><th>Product</th><th>Current Stock</th><th>Min Threshold</th></tr></thead>
<tbody>${rows}</tbody></table>
<div style="text-align:center;margin-top:24px">
<a href="${SITE_URL}/admin/inventory" class="btn">Manage Inventory →</a>
</div></div>`);
  return sendEmail({ to: process.env.SMTP_USER, subject: `⚠️ Low Stock Alert – ${items.length} products need restocking`, html });
};

export const sendNewMessageEmail = async ({ toAdmin, toEmail, toName, userName, userEmail, subject, body, conversationId }) => {
  if (toAdmin) {
    const html = baseTemplate(`
<div class="header"><h1>💬 New Direct Message</h1><p>From the website</p></div>
<div class="body">
<h2>New message received</h2>
<div class="info-grid">
  <div class="info-box"><div class="label">From</div><div class="value">${userName}</div></div>
  <div class="info-box"><div class="label">Email</div><div class="value">${userEmail}</div></div>
</div>
<div class="info-box" style="margin-top:12px"><div class="label">Subject</div><div class="value">${subject}</div></div>
<div class="info-box" style="margin-top:12px"><div class="label">Message</div><div class="value">${body}</div></div>
<div style="text-align:center;margin-top:24px">
<a href="${SITE_URL}/admin/messages/${conversationId}" class="btn">Reply in Admin Panel →</a>
</div></div>`);
    return sendEmail({ to: process.env.SMTP_USER, subject: `💬 New Message: ${subject} — ${userName}`, html });
  }
  const html = baseTemplate(`
<div class="header"><h1>💬 New Reply from Shah International</h1><p>${subject}</p></div>
<div class="body">
<h2>Hi ${toName},</h2>
<p>You have a new reply regarding "<strong>${subject}</strong>":</p>
<div class="info-box" style="margin:16px 0"><div class="value">${body}</div></div>
<div style="text-align:center;margin-top:24px">
<a href="${SITE_URL}/messages" class="btn">View Conversation →</a>
</div></div>`);
  return sendEmail({ to: toEmail, subject: `💬 Reply: ${subject} | Shah International`, html });
};

export const sendPasswordReset = async (user, resetUrl) => {
  const html = baseTemplate(`
<div class="header"><h1>🔐 Password Reset</h1><p>Shah International</p></div>
<div class="body">
<h2>Hi ${user.name},</h2>
<p>We received a request to reset your password. Click the button below to set a new password. This link expires in 1 hour.</p>
<div style="text-align:center;margin:28px 0">
<a href="${resetUrl}" class="btn">Reset Password →</a>
</div>
<p style="font-size:13px;color:#9ca3af">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
</div>`);
  return sendEmail({ to: user.email, subject: '🔐 Password Reset Request | Shah International', html });
};
