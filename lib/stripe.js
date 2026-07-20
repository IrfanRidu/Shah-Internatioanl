import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const createPaymentIntent = async (amount, currency = 'bdt', metadata = {}) => {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    metadata,
    automatic_payment_methods: { enabled: true },
  });
};

export const retrievePaymentIntent = async (id) => {
  return stripe.paymentIntents.retrieve(id);
};

export const createRefund = async (chargeId, amount) => {
  return stripe.refunds.create({ charge: chargeId, amount: amount ? Math.round(amount * 100) : undefined });
};

export default stripe;
