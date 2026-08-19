import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['user', 'admin'], required: true },
  // Batch 19 (R33-7): no longer required at the schema level — an attachment-only message (no
  // caption text) is now valid. Enforced instead at the API layer: a message needs EITHER body
  // text OR at least one attachment, not necessarily both — see app/api/messages/[id]/route.js.
  body: { type: String, default: '' },
  // Was `[{ type: String }]` — bare URLs, uploaded but never actually usable: no filename to label
  // a download link with, no mimetype to decide "show an image thumbnail" vs "show a generic file
  // card", no size to display. Upgraded to carry what the chat UI actually needs to render well.
  attachments: [{
    url: { type: String, required: true },
    name: String,
    type: String,
    size: Number,
  }],
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

MessageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
