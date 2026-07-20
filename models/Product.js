import mongoose from 'mongoose';

const CertificationSchema = new mongoose.Schema({
  name: String,
  issuer: String,
  year: String,
  image: String,
});

const NutritionalInfoSchema = new mongoose.Schema({
  calories: Number,
  protein: String,
  carbohydrates: String,
  fiber: String,
  vitamins: [String],
});

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  scientificName: { type: String, trim: true },
  slug: { type: String, required: true, unique: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subcategorySlug: String,
  description: { type: String, required: true },
  shortDescription: String,
  images: [{ type: String }],
  // Stock & Quantity
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'kg', enum: ['kg', 'ton', 'piece', 'box', 'bundle', 'bag', 'liter'] },
  minimumOrderQuantity: { type: Number, default: 1 },
  maximumOrderQuantity: { type: Number },
  // Pricing
  price: { type: Number }, // BDT price for local buyers
  discountPrice: { type: Number }, // BDT discounted price
  priceRangeMin: { type: Number }, // USD min for international
  priceRangeMax: { type: Number }, // USD max for international
  productCost: { type: Number }, // Admin only - BDT cost
  // Seasonal
  harvestingSeason: { type: String }, // e.g. "June-September"
  harvestingMonths: [{ type: Number }], // month numbers 1-12
  isHarvestingSeason: { type: Boolean, default: true },
  allowPreOrder: { type: Boolean, default: true },
  preOrderNote: String,
  // Origin & Location
  countryOfOrigin: { type: String, default: 'Bangladesh' },
  harvestingLocation: String,
  // Details
  certifications: [CertificationSchema],
  nutritionalInfo: NutritionalInfoSchema,
  shelfLife: String,
  storageInstructions: String,
  packagingOptions: [String],
  // Status
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isOrganic: { type: Boolean, default: false },
  tags: [String],
  // SEO
  metaTitle: String,
  metaDescription: String,
  // Ratings
  averageRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  // Availability
  availableForLocal: { type: Boolean, default: true },
  availableForInternational: { type: Boolean, default: true },
}, { timestamps: true });

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ isFeatured: 1, isActive: 1 });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
