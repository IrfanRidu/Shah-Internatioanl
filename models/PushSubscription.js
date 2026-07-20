import mongoose from 'mongoose';

const PushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
  isActive: { type: Boolean, default: true },
  lastUsed: Date,
}, { timestamps: true });

export default mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);
