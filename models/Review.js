import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: String,
  comment: String,
  isVerified: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  adminReply: String,
}, { timestamps: true });

export default mongoose.models.Review || mongoose.model('Review', ReviewSchema);
