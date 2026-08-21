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
  // Local/common/regional name (e.g. Bengali name) — a third naming field alongside Product Name
  // and Botanical Name. Purely descriptive + searchable; nothing auto-fills FROM it (unlike
  // scientificName → botanicalName in the Shipment Details product table), it's just another
  // field every product search (storefront + admin + shipment picker) matches against.
  localName: { type: String, trim: true },
  // Batch 7 — optional HS (Harmonized System) customs code. When set, auto-fills a shipment item's
  // hsCode the moment this product is picked in the Shipment Details product table (same
  // auto-fill-then-editable pattern as scientificName → botanicalName below).
  hsCode: { type: String, trim: true },
  slug: { type: String, required: true, unique: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subcategorySlug: String,
  description: { type: String, required: true },
  shortDescription: String,
  images: [{ type: String }],
  // Stock & Quantity
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'kg', enum: ['kg', 'ton', 'piece', 'box', 'bundle', 'bag', 'liter'] },
  // Legacy single MOQ field — kept (not removed) so any product saved before the local/international
  // split below still has a sensible value. New code should read minimumOrderQuantityLocal /
  // minimumOrderQuantityInternational via lib/utils.js's getMoqForBuyer(), which falls back to this
  // field automatically when the split fields are unset.
  minimumOrderQuantity: { type: Number, default: 1 },
  minimumOrderQuantityLocal: { type: Number },
  minimumOrderQuantityInternational: { type: Number },
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
  shelfLife: { type: Number, min: 0 }, // days — auto-formatted as "X days" wherever shown (issue 5)
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
  // Admin-defined extra spec rows (e.g. "Grade: A+", "Packing: Carton") — free-form label/value pairs
  // set per-product on the add/edit form and rendered alongside the built-in spec tiles (Origin,
  // Season, Min. Order, etc.) on the product details page.
  additionalFields: [{
    label: { type: String, trim: true },
    value: { type: String, trim: true },
  }],
}, { timestamps: true });

// Kept in sync with buildProductQuery's regex search fields (name, scientificName, localName,
// tags) even though the app's actual search path is regex-based, not $text-based — this index is
// otherwise unused today but should stay truthful to what "searchable" means for this schema.
ProductSchema.index({ name: 'text', scientificName: 'text', localName: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ isFeatured: 1, isActive: 1 });
ProductSchema.index({ harvestingMonths: 1 });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
