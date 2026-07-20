import mongoose from 'mongoose';

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: String,
  type: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true },
  minimumOrderAmount: { type: Number, default: 0 },
  maximumDiscount: Number,
  usageLimit: Number,
  usagePerUser: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  usedBy: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, count: Number }],
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  applicableFor: { type: String, enum: ['all', 'local', 'international'], default: 'all' },
  applicableCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, { timestamps: true });

export default mongoose.models.Coupon || mongoose.model('Coupon', CouponSchema);
