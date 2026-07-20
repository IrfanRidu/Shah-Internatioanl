import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  image: String,
  quantity: { type: Number, required: true, min: 1 },
  unit: String,
  price: { type: Number, required: true }, // BDT
  productCost: { type: Number }, // Admin only
  isPreOrder: { type: Boolean, default: false },
});

const DeliveryAddressSchema = new mongoose.Schema({
  name: String,
  phone: String,
  street: String,
  area: String,
  city: String,
  district: String,
  zipCode: String,
  country: String,
});

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderType: { type: String, enum: ['local', 'international'], required: true },
  items: [OrderItemSchema],
  // Pricing
  subtotal: { type: Number, required: true },
  deliveryCharge: { type: Number, default: 0 },
  deliveryZoneName: String, // which zone the customer selected at checkout
  discount: { type: Number, default: 0 },
  couponCode: String,
  couponDiscount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, required: true },
  // Payment
  paymentMethod: { type: String, enum: ['stripe', 'cod', 'bank_transfer', 'bkash', 'nagad'] },
  paymentStatus: { type: String, enum: ['pending', 'awaiting_verification', 'paid', 'failed', 'refunded', 'partially_refunded'], default: 'pending' },
  stripePaymentIntentId: String,
  stripeChargeId: String,
  // Manual mobile-banking payment verification (bKash/Nagad). The customer
  // submits their Transaction ID after sending money via their own app;
  // an admin cross-checks it against their bKash/Nagad merchant dashboard
  // and marks it verified before the order proceeds past "processing".
  paymentVerification: {
    trxId: String,
    senderNumber: String,
    submittedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    rejectionReason: String,
  },
  // Set when a COD order's delivery charge was required (and paid) upfront
  // via Stripe — see Settings.payment.codDeliveryChargeRequired.
  deliveryChargePaymentIntentId: String,
  deliveryChargePaid: { type: Boolean, default: false },
  // Status
  status: {
    type: String,
    enum: ['processing', 'confirmed', 'cancelled', 'onTheWay', 'delivered', 'returned'],
    default: 'processing',   // all new orders start as "processing"
  },
  statusHistory: [{
    status: String,
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
  }],
  // Delivery
  deliveryAddress: DeliveryAddressSchema,
  estimatedDelivery: Date,
  deliveredAt: Date,
  // Cancellation/Return
  cancelReason: String,
  cancelledAt: Date,
  returnReason: String,
  returnedAt: Date,
  // Notes
  customerNote: String,
  adminNote: String,
  // International specific
  quotationReference: String,
}, { timestamps: true });

OrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.models.Order.countDocuments();
    this.orderNumber = `SI${String(count + 1001).padStart(6, '0')}`;
  }
  next();
});

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
