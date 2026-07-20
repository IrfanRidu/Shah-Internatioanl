'use client';
import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import StripePaymentForm from './StripePaymentForm';
import DeliveryChargePaymentForm from './DeliveryChargePaymentForm';
import toast from 'react-hot-toast';
import { MapPin, CreditCard, Truck, CheckCircle, Banknote, Smartphone, Copy, AlertCircle } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function CheckoutPage() {
  const { data: session } = useSession();
  const { items, total, coupon, couponDiscount, clearCart } = useCart();
  const { format } = useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [step, setStep] = useState(1); // 1=address, 2=payment
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [addr, setAddr] = useState({
    name: session?.user?.name || '', phone: session?.user?.phone || '',
    street: '', area: '', city: 'Dhaka', district: 'Dhaka', zipCode: '',
  });
  const setA = (k, v) => setAddr(p => ({ ...p, [k]: v }));

  // Admin-configured delivery zones — fetched live, shown to the customer for
  // selection (previously a flat ৳60/free-above-৳1000 rate was hardcoded and
  // zones were never actually shown, per spec item 29).
  const [settings, setSettings] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setSettings(d.settings);
      const zones = (d.settings?.deliveryZones || []).filter(z => z.isActive !== false);
      if (zones.length > 0) setSelectedZone(zones[0].name);
    });
  }, []);

  const zones = (settings?.deliveryZones || []).filter(z => z.isActive !== false);
  const activeZone = zones.find(z => z.name === selectedZone);
  const DELIVERY = activeZone
    ? (activeZone.freeAbove > 0 && total >= activeZone.freeAbove ? 0 : activeZone.charge)
    : (total >= (settings?.freeDeliveryAbove || 1000) ? 0 : (settings?.localDeliveryCharge ?? 60));
  const grandTotal = total + DELIVERY;

  // bKash / Nagad manual payment proof — required before an order using
  // either method can be submitted (spec item 28: no more placing an order
  // "paid" via these methods without actually sending money first).
  const [trxId, setTrxId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const merchantNumber = paymentMethod === 'bkash' ? settings?.payment?.bkashNumber : settings?.payment?.nagadNumber;

  // COD delivery-charge prepayment — only relevant if the admin has turned
  // this on (spec item 30).
  const codChargeRequired = !!settings?.payment?.codDeliveryChargeRequired && DELIVERY > 0;
  const [deliveryChargeClientSecret, setDeliveryChargeClientSecret] = useState('');
  const [deliveryChargePaymentIntentId, setDeliveryChargePaymentIntentId] = useState('');
  const [deliveryChargePaid, setDeliveryChargePaid] = useState(false);

  const payMethods = [
    { id: 'cod', label: 'Cash on Delivery', icon: Banknote, desc: 'Pay when your order arrives', color: 'green' },
    { id: 'stripe', label: 'Card / Online', icon: CreditCard, desc: 'Visa, Mastercard, American Express', color: 'blue' },
    { id: 'bkash', label: 'bKash', icon: Smartphone, desc: 'Send Money, then confirm here', color: 'pink' },
    { id: 'nagad', label: 'Nagad', icon: Smartphone, desc: 'Send Money, then confirm here', color: 'orange' },
  ];

  const copyNumber = () => {
    if (!merchantNumber) return;
    navigator.clipboard.writeText(merchantNumber);
    toast.success('Number copied!');
  };

  const startDeliveryChargePayment = async () => {
    setLoading(true);
    const res = await fetch('/api/payment/create-delivery-charge-intent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtotal: total, zoneName: selectedZone }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) { setDeliveryChargeClientSecret(data.clientSecret); setDeliveryChargePaymentIntentId(data.paymentIntentId); }
    else toast.error(data.message);
  };

  const createOrder = async () => {
    if (!addr.name || !addr.phone || !addr.street || !addr.city) {
      toast.error('Please fill all required delivery fields');
      return false;
    }
    if (items.length === 0) { toast.error('Your cart is empty'); return false; }
    if ((paymentMethod === 'bkash' || paymentMethod === 'nagad') && (!trxId.trim() || !senderNumber.trim())) {
      toast.error(`Please send the payment via ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} first, then enter your Transaction ID and phone number`);
      return false;
    }
    if (paymentMethod === 'cod' && codChargeRequired && !deliveryChargePaid) {
      toast.error('Please pay the delivery charge first to place a Cash on Delivery order');
      return false;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.productId, name: i.name, quantity: i.quantity })),
          deliveryAddress: addr, paymentMethod, orderType: 'local', couponCode: coupon?.code, notes: '',
          deliveryZoneName: selectedZone,
          trxId: paymentMethod === 'bkash' || paymentMethod === 'nagad' ? trxId : undefined,
          senderNumber: paymentMethod === 'bkash' || paymentMethod === 'nagad' ? senderNumber : undefined,
          deliveryChargePaymentIntentId: paymentMethod === 'cod' && codChargeRequired ? deliveryChargePaymentIntentId : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.message); return false; }
      setCreatedOrderId(data.order._id);
      return data.order;
    } catch { toast.error('Failed to create order'); return false; }
    finally { setLoading(false); }
  };

  const handleProceedToPayment = async () => {
    const order = await createOrder();
    if (!order) return;
    if (paymentMethod === 'cod') {
      clearCart();
      toast.success('🎉 Order placed successfully!');
      router.push(`/orders/${order._id}`);
    } else if (paymentMethod === 'bkash' || paymentMethod === 'nagad') {
      clearCart();
      toast.success('🎉 Order submitted! We\'ll confirm your payment shortly.');
      router.push(`/orders/${order._id}`);
    } else if (paymentMethod === 'stripe') {
      const piRes = await fetch('/api/payment/create-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order._id }),
      });
      const piData = await piRes.json();
      if (piData.success) { setClientSecret(piData.clientSecret); setStep(2); }
      else toast.error('Payment setup failed');
    }
  };

  const handleStripeSuccess = () => { clearCart(); toast.success('🎉 Payment successful!'); router.push(`/orders/${createdOrderId}?payment=success`); };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Progress */}
      <div className="flex items-center gap-4 mb-8">
        {[{ n: 1, label: 'Delivery' }, { n: 2, label: 'Payment' }].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= n ? 'text-white' : 'bg-gray-200 text-gray-500'}`} style={step >= n ? { backgroundColor: 'var(--color-primary)' } : {}}>
              {step > n ? '✓' : n}
            </div>
            <span className={`text-sm font-medium ${step >= n ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
            {n < 2 && <div className={`w-12 h-0.5 ${step > n ? 'bg-brand' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left */}
        <div className="lg:col-span-3">
          {step === 1 && (
            <>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2"><MapPin className="w-5 h-5 text-brand" /> Delivery Address</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Full Name" required placeholder="Recipient name" value={addr.name} onChange={e => setA('name', e.target.value)} />
                  <Input label="Phone Number" required placeholder="01XXXXXXXXX" value={addr.phone} onChange={e => setA('phone', e.target.value)} />
                  <div className="sm:col-span-2"><Input label="Street Address" required placeholder="House/Flat, Road/Street" value={addr.street} onChange={e => setA('street', e.target.value)} /></div>
                  <Input label="Area / Thana" placeholder="Mirpur, Uttara..." value={addr.area} onChange={e => setA('area', e.target.value)} />
                  <Input label="City" required value={addr.city} onChange={e => setA('city', e.target.value)} />
                  <Input label="District" value={addr.district} onChange={e => setA('district', e.target.value)} />
                  <Input label="ZIP Code" placeholder="1200" value={addr.zipCode} onChange={e => setA('zipCode', e.target.value)} />
                </div>
              </div>

              {/* Delivery Zone Selection — item #29: zones are now actually shown */}
              {zones.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 mb-5">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-brand" /> Delivery Zone</h2>
                  <div className="space-y-2">
                    {zones.map(zone => {
                      const zoneCharge = zone.freeAbove > 0 && total >= zone.freeAbove ? 0 : zone.charge;
                      return (
                        <label key={zone.name} className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${selectedZone === zone.name ? 'border-brand bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                          <input type="radio" name="zone" checked={selectedZone === zone.name} onChange={() => setSelectedZone(zone.name)} className="sr-only" />
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selectedZone === zone.name ? 'border-brand' : 'border-gray-300'}`}>
                            {selectedZone === zone.name && <div className="w-2 h-2 rounded-full bg-brand" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{zone.name}</p>
                            {zone.estimatedDays && <p className="text-xs text-gray-400">Estimated: {zone.estimatedDays}</p>}
                          </div>
                          <p className={`text-sm font-bold flex-shrink-0 ${zoneCharge === 0 ? 'text-green-600' : 'text-gray-700 dark:text-gray-300'}`}>
                            {zoneCharge === 0 ? 'FREE' : format(zoneCharge)}
                          </p>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2"><CreditCard className="w-5 h-5 text-brand" /> Payment Method</h2>
                <div className="space-y-3">
                  {payMethods.map(({ id, label, icon: Icon, desc }) => (
                    <label key={id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === id ? 'border-brand bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                      <input type="radio" name="pm" value={id} checked={paymentMethod === id} onChange={() => { setPaymentMethod(id); setDeliveryChargePaid(false); setDeliveryChargeClientSecret(''); }} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentMethod === id ? 'border-brand' : 'border-gray-300'}`}>
                        {paymentMethod === id && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                      </div>
                      <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1"><p className="font-semibold text-gray-900 dark:text-white text-sm">{label}</p><p className="text-xs text-gray-400">{desc}</p></div>
                      {paymentMethod === id && <CheckCircle className="w-5 h-5 text-brand flex-shrink-0" />}
                    </label>
                  ))}
                </div>

                {/* bKash / Nagad — Send Money instructions + TrxID proof form */}
                {(paymentMethod === 'bkash' || paymentMethod === 'nagad') && (
                  <div className="mt-4 p-4 rounded-xl border-2 border-dashed" style={{ borderColor: paymentMethod === 'bkash' ? '#e2136e' : '#f7941d', backgroundColor: paymentMethod === 'bkash' ? '#fdf2f8' : '#fff7ed' }}>
                    <p className="text-sm font-bold text-gray-800 mb-2">Step 1 — Send Money</p>
                    {merchantNumber ? (
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-lg font-mono font-bold text-gray-900 bg-white px-3 py-1.5 rounded-lg border">{merchantNumber}</p>
                        <button onClick={copyNumber} className="p-2 rounded-lg bg-white border hover:bg-gray-50 transition-colors"><Copy className="w-4 h-4 text-gray-500" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-700 text-sm mb-3"><AlertCircle className="w-4 h-4 flex-shrink-0" /> This store hasn't configured a {paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} number yet — please choose another payment method or contact us.</div>
                    )}
                    <p className="text-xs text-gray-500 mb-3">
                      Open your {paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} app → Send Money → enter the number above → amount <b>{format(grandTotal)}</b> → complete the transfer.
                    </p>
                    <p className="text-sm font-bold text-gray-800 mb-2">Step 2 — Confirm Your Payment</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Transaction ID (TrxID)" required placeholder="e.g. 8N7A2B1C3D" value={trxId} onChange={e => setTrxId(e.target.value)} />
                      <Input label="Number You Paid From" required placeholder="01XXXXXXXXX" value={senderNumber} onChange={e => setSenderNumber(e.target.value)} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">We'll verify this against our {paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} merchant account and confirm your order shortly.</p>
                  </div>
                )}

                {/* COD delivery charge prepayment (only if admin requires it) */}
                {paymentMethod === 'cod' && codChargeRequired && (
                  <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">Delivery Charge Must Be Paid Online</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                      This store requires the delivery fee ({format(DELIVERY)}) to be paid upfront for Cash on Delivery orders. The product cost itself is still paid in cash at your door.
                    </p>
                    {deliveryChargePaid ? (
                      <div className="flex items-center gap-2 text-green-700 text-sm font-semibold"><CheckCircle className="w-4 h-4" /> Delivery charge paid — you can now place your order</div>
                    ) : deliveryChargeClientSecret ? (
                      <Elements stripe={stripePromise} options={{ clientSecret: deliveryChargeClientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#2d6a4f' } } }}>
                        <DeliveryChargePaymentForm amount={DELIVERY} onSuccess={() => setDeliveryChargePaid(true)} />
                      </Elements>
                    ) : (
                      <Button onClick={startDeliveryChargePayment} loading={loading} variant="primary" size="sm">Pay Delivery Charge ({format(DELIVERY)})</Button>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleProceedToPayment}
                  loading={loading}
                  variant="primary"
                  className="w-full mt-5"
                  size="lg"
                  disabled={paymentMethod === 'cod' && codChargeRequired && !deliveryChargePaid}
                >
                  <Truck className="w-4 h-4" /> {paymentMethod === 'stripe' ? 'Proceed to Payment' : paymentMethod === 'bkash' || paymentMethod === 'nagad' ? 'Confirm Payment & Place Order' : 'Place Order'}
                </Button>
              </div>
            </>
          )}

          {step === 2 && clientSecret && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2"><CreditCard className="w-5 h-5 text-brand" /> Card Payment</h2>
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#2d6a4f' } } }}>
                <StripePaymentForm orderId={createdOrderId} onSuccess={handleStripeSuccess} amount={grandTotal} />
              </Elements>
              <button onClick={() => setStep(1)} className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">← Back to delivery</button>
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 sticky top-20">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4 max-h-52 overflow-y-auto pr-1">
              {items.map(item => (
                <div key={item.productId} className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    <Image src={item.image || 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=100&q=80'} alt={item.name} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 dark:text-white truncate">{item.name}</p><p className="text-xs text-gray-400">×{item.quantity} {item.unit}</p></div>
                  <p className="text-sm font-semibold flex-shrink-0">{format(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>{format(total)}</span></div>
              {couponDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-{format(couponDiscount)}</span></div>}
              <div className="flex justify-between text-sm text-gray-500">
                <span>Delivery {activeZone ? `(${activeZone.name})` : ''}</span>
                <span className={DELIVERY === 0 ? 'text-green-600' : ''}>{DELIVERY === 0 ? 'FREE' : format(DELIVERY)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100 dark:border-gray-800">
                <span>Total</span><span className="text-brand">{format(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
