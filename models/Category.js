import mongoose from 'mongoose';

const SubcategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  description: String,
  image: String,
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
});

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  image: String,
  icon: String,
  subcategories: [SubcategorySchema],
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  metaTitle: String,
  metaDescription: String,
}, { timestamps: true });

export default mongoose.models.Category || mongoose.model('Category', CategorySchema);
