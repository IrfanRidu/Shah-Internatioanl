import mongoose from 'mongoose';

const BannerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: String,
  description: String,
  image: { type: String, required: true },
  mobileImage: String,
  link: String,
  buttonText: String,
  type: { type: String, enum: ['hero', 'promotional', 'popup', 'side'], default: 'hero' },
  position: { type: String, enum: ['home', 'products', 'all'], default: 'home' },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  targetAudience: { type: String, enum: ['all', 'local', 'international'], default: 'all' },
  startDate: Date,
  endDate: Date,
  backgroundColor: String,
  textColor: String,
}, { timestamps: true });

export default mongoose.models.Banner || mongoose.model('Banner', BannerSchema);
