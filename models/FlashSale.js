import mongoose from 'mongoose';

const CampaignItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  salePrice: { type: Number, required: true },
  salePriceUSD: Number,
  discountPercentage: Number,
  quantityLimit: Number,
  soldCount: { type: Number, default: 0 },
});

// Unified Campaign model (replaces FlashSale).
// Default campaign type is "Flash Sale"; admins can rename and fully brand each campaign.
const FlashSaleSchema = new mongoose.Schema({
  // Core
  title: { type: String, required: true, default: 'Flash Sale' },
  description: String,
  items: [CampaignItemSchema],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  targetAudience: { type: String, enum: ['all', 'local', 'international'], default: 'all' },

  // Branding — admin can fully customise the campaign look
  displayName: { type: String, default: 'Flash Sale' },   // shown on badge & section heading
  bannerImage: String,                                      // optional hero image for the section
  backgroundColor: { type: String, default: '#1a1a2e' },   // section background
  textColor: { type: String, default: '#ffffff' },          // heading / timer text
  badgeText: { type: String, default: 'SALE' },             // e.g. "HOT DEAL", "EID OFFER"
  badgeColor: { type: String, default: '#ef4444' },         // badge background
  badgTextColor: { type: String, default: '#ffffff' },

  // Homepage placement hint (set automatically based on other active campaigns)
  displayOrder: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.models.FlashSale || mongoose.model('FlashSale', FlashSaleSchema);
