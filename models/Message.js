import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['user', 'admin'], required: true },
  body: { type: String, required: true },
  attachments: [{ type: String }],
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

MessageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
