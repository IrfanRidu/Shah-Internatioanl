import mongoose from 'mongoose';

const PageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String },
  metaTitle: String,
  metaDescription: String,
  isActive: { type: Boolean, default: true },
  showInHeader: { type: Boolean, default: false },
  showInFooter: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.models.Page || mongoose.model('Page', PageSchema);
