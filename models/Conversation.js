import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  type: { type: String, enum: ['quotation', 'support', 'general'], default: 'general' },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  lastMessage: { type: String },
  lastMessageAt: { type: Date, default: Date.now },
  lastSenderRole: { type: String, enum: ['user', 'admin'] },
  unreadByUser: { type: Boolean, default: false },
  unreadByAdmin: { type: Boolean, default: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

ConversationSchema.index({ user: 1, updatedAt: -1 });
ConversationSchema.index({ status: 1, unreadByAdmin: 1 });

export default mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
