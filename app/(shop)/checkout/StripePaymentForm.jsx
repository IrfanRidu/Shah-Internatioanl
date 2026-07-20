'use client';
import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Button from '@/components/ui/Button';
import { Lock } from 'lucide-react';

export default function StripePaymentForm({ orderId, onSuccess, amount }) {
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

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders/${orderId}?payment=success` },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message);
      setLoading(false);
    } else {
      onSuccess?.();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>}
      <Button type="submit" variant="primary" className="w-full" size="lg" loading={loading || !stripe}>
        <Lock className="w-4 h-4" /> Pay ৳{amount?.toLocaleString()}
      </Button>
      <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" /> Secured by Stripe · 256-bit SSL encryption
      </p>
    </form>
  );
}
