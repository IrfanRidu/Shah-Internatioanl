'use client';
import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Button from '@/components/ui/Button';
import { Lock } from 'lucide-react';

/**
 * Small inline Stripe payment form for prepaying just the delivery charge
 * on a Cash-on-Delivery order (used only when the admin has turned on
 * Settings → Payment → "Require delivery charge payment for COD").
 *
 * Unlike StripePaymentForm (which pays for the whole order and redirects to
 * the order confirmation page), this form confirms a small standalone
 * PaymentIntent and reports success back to the checkout page in place —
 * the order itself hasn't been created yet at this point in the flow, so
 * there's nothing to redirect to.
 */
export default function DeliveryChargePaymentForm({ amount, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');

    const { error: submitError } = await elements.submit();
    if (submitError) { setError(submitError.message); setLoading(false); return; }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // stay on the checkout page — the order isn't created yet
    });

    if (confirmError) {
      setError(confirmError.message);
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      onSuccess?.();
    } else {
      setError('Payment could not be confirmed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-600">{error}</div>}
      <Button type="submit" variant="primary" className="w-full" size="sm" loading={loading || !stripe}>
        <Lock className="w-3.5 h-3.5" /> Pay Delivery Charge — ৳{amount?.toLocaleString()}
      </Button>
      <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" /> Secured by Stripe
      </p>
    </form>
  );
}
