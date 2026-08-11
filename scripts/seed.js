/**
 * Shah International – Database Seed Script
 * Run: node scripts/seed.js
 *
 * Demo Accounts:
 * ─────────────────────────────────────────────────
 * Super Admin : admin@shahintl.com      / SuperAdmin123!
 * Admin       : manager@shahintl.com    / Admin123!
 * Editor      : editor@shahintl.com     / Editor123!
 * Local #1    : rahul.bd@test.com       / Test123!
 * Local #2    : fatima.bd@test.com      / Test123!
 * Int'l  #1   : john.importer@test.com  / Test123!
 * Int'l  #2   : sarah.eu@test.com       / Test123!
 * ─────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ MONGODB_URI not set in .env.local'); process.exit(1); }

// ─── Inline schemas (avoids ESM import issues in CommonJS seed) ──────────────
const UserSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true, lowercase: true }, phone: String, password: String, role: String, buyerType: String, country: String, company: String, isActive: { type: Boolean, default: true }, address: mongoose.Schema.Types.Mixed }, { timestamps: true });
const CategorySchema = new mongoose.Schema({ name: String, slug: String, description: String, image: String, subcategories: [{ name: String, slug: String, description: String, image: String, isActive: { type: Boolean, default: true }, displayOrder: Number }], isActive: { type: Boolean, default: true }, displayOrder: Number }, { timestamps: true });
const ProductSchema = new mongoose.Schema({ name: String, scientificName: String, localName: String, slug: String, category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, subcategorySlug: String, description: String, shortDescription: String, images: [String], quantity: Number, unit: String, minimumOrderQuantity: Number, price: Number, discountPrice: Number, priceRangeMin: Number, priceRangeMax: Number, productCost: Number, harvestingSeason: String, harvestingMonths: [Number], isHarvestingSeason: Boolean, allowPreOrder: Boolean, countryOfOrigin: String, harvestingLocation: String, certifications: [mongoose.Schema.Types.Mixed], isActive: Boolean, isFeatured: Boolean, isOrganic: Boolean, availableForLocal: Boolean, availableForInternational: Boolean, tags: [String], storageInstructions: String, shelfLife: Number }, { timestamps: true });
const InventorySchema = new mongoose.Schema({ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', unique: true }, currentStock: Number, reservedStock: { type: Number, default: 0 }, availableStock: Number, minimumStockAlert: { type: Number, default: 10 }, transactions: [mongoose.Schema.Types.Mixed], lastRestocked: Date, lastRestockedQuantity: Number }, { timestamps: true });
const BannerSchema = new mongoose.Schema({ title: String, subtitle: String, image: String, link: String, buttonText: String, type: String, position: String, isActive: Boolean, displayOrder: Number, targetAudience: String }, { timestamps: true });
const FlashSaleSchema = new mongoose.Schema({ title: String, description: String, items: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, salePrice: Number, discountPercentage: Number, quantityLimit: Number, soldCount: { type: Number, default: 0 } }], startTime: Date, endTime: Date, isActive: Boolean, targetAudience: String }, { timestamps: true });
const CouponSchema = new mongoose.Schema({ code: { type: String, unique: true, uppercase: true }, description: String, type: String, value: Number, minimumOrderAmount: Number, maximumDiscount: Number, usageLimit: Number, usedCount: { type: Number, default: 0 }, validFrom: Date, validUntil: Date, isActive: Boolean, applicableFor: String }, { timestamps: true });
const SettingsSchema = new mongoose.Schema({ siteTitle: String, siteTagline: String, siteDescription: String, logo: String, contact: mongoose.Schema.Types.Mixed, social: mongoose.Schema.Types.Mixed, activeTheme: String, activeLanguage: String, localDeliveryCharge: Number, freeDeliveryAbove: Number, footerSections: [mongoose.Schema.Types.Mixed], aboutUs: String }, { timestamps: true });
const SpecialSectionSchema = new mongoose.Schema({ title: String, description: String, badge: String, products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], isActive: Boolean, position: String, displayOrder: Number, targetAudience: String }, { timestamps: true });
const CurrencyRateSchema = new mongoose.Schema({ base: String, rates: mongoose.Schema.Types.Mixed, lastUpdated: Date }, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);
const Banner = mongoose.models.Banner || mongoose.model('Banner', BannerSchema);
const FlashSale = mongoose.models.FlashSale || mongoose.model('FlashSale', FlashSaleSchema);
const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', CouponSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
const SpecialSection = mongoose.models.SpecialSection || mongoose.model('SpecialSection', SpecialSectionSchema);
const CurrencyRate = mongoose.models.CurrencyRate || mongoose.model('CurrencyRate', CurrencyRateSchema);

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function hash(p) { return bcrypt.hash(p, 12); }

async function seed() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  // Clear existing
  console.log('🗑️  Clearing existing data...');
  await Promise.all([User, Category, Product, Inventory, Banner, FlashSale, Coupon, Settings, SpecialSection, CurrencyRate].map(M => M.deleteMany({})));
  console.log('✅ Cleared\n');

  // ── USERS ────────────────────────────────────────────────
  console.log('👤 Creating users...');
  const usersData = [
    { name: 'Super Admin', email: 'admin@shahintl.com', password: await hash('SuperAdmin123!'), role: 'superAdmin', buyerType: 'local', country: 'Bangladesh' },
    { name: 'Manager Ahmed', email: 'manager@shahintl.com', password: await hash('Admin123!'), role: 'admin', buyerType: 'local', country: 'Bangladesh', phone: '+8801711000001' },
    { name: 'Content Editor', email: 'editor@shahintl.com', password: await hash('Editor123!'), role: 'editor', buyerType: 'local', country: 'Bangladesh', phone: '+8801711000002' },
    { name: 'Rahul Ahmed', email: 'rahul.bd@test.com', password: await hash('Test123!'), role: 'localBuyer', buyerType: 'local', country: 'Bangladesh', phone: '+8801711000003', address: { street: '45 Mirpur Road', area: 'Mirpur', city: 'Dhaka', district: 'Dhaka', zipCode: '1216', country: 'Bangladesh' } },
    { name: 'Fatima Begum', email: 'fatima.bd@test.com', password: await hash('Test123!'), role: 'localBuyer', buyerType: 'local', country: 'Bangladesh', phone: '+8801811000004', address: { street: '12 CDA Avenue', area: 'Agrabad', city: 'Chittagong', district: 'Chittagong', zipCode: '4100', country: 'Bangladesh' } },
    { name: 'John Smith', email: 'john.importer@test.com', password: await hash('Test123!'), role: 'internationalBuyer', buyerType: 'international', country: 'United States', phone: '+12125550001', company: 'Fresh Imports LLC' },
    { name: 'Sarah Mueller', email: 'sarah.eu@test.com', password: await hash('Test123!'), role: 'internationalBuyer', buyerType: 'international', country: 'United Kingdom', phone: '+447700900001', company: 'EuroFresh Trading Ltd' },
  ];
  const users = await User.insertMany(usersData);
  console.log(`   ✅ ${users.length} users created`);

  // ── CATEGORIES ───────────────────────────────────────────
  console.log('📂 Creating categories...');
  const catsData = [
    { name: 'Vegetables', slug: 'vegetables', description: 'Fresh seasonal vegetables from Bangladesh farms', displayOrder: 1, isActive: true, subcategories: [
      { name: 'Leafy Greens', slug: 'leafy-greens', description: 'Spinach, amaranth, and more', isActive: true, displayOrder: 1 },
      { name: 'Root Vegetables', slug: 'root-vegetables', description: 'Potatoes, carrots, radish', isActive: true, displayOrder: 2 },
      { name: 'Gourds', slug: 'gourds', description: 'Bitter gourd, ridge gourd, snake gourd', isActive: true, displayOrder: 3 },
      { name: 'Cruciferous', slug: 'cruciferous', description: 'Cauliflower, cabbage, broccoli', isActive: true, displayOrder: 4 },
    ]},
    { name: 'Fruits', slug: 'fruits', description: 'Tropical and seasonal fruits', displayOrder: 2, isActive: true, subcategories: [
      { name: 'Tropical Fruits', slug: 'tropical-fruits', description: 'Mango, jackfruit, papaya', isActive: true, displayOrder: 1 },
      { name: 'Citrus', slug: 'citrus', description: 'Lemon, orange, lime', isActive: true, displayOrder: 2 },
      { name: 'Other Fruits', slug: 'other-fruits', description: 'Guava, banana, pineapple', isActive: true, displayOrder: 3 },
    ]},
    { name: 'Herbs & Spices', slug: 'herbs-spices', description: 'Fresh herbs and dried spices', displayOrder: 3, isActive: true, subcategories: [
      { name: 'Fresh Herbs', slug: 'fresh-herbs', description: 'Coriander, mint, basil', isActive: true, displayOrder: 1 },
      { name: 'Spice Roots', slug: 'spice-roots', description: 'Ginger, turmeric, galangal', isActive: true, displayOrder: 2 },
    ]},
  ];
  const categories = await Category.insertMany(catsData);
  const [vegCat, fruitCat, herbCat] = categories;
  console.log(`   ✅ ${categories.length} categories created`);

  // ── PRODUCTS ─────────────────────────────────────────────
  console.log('🌿 Creating products...');
  const PLACEHOLDER = 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=600&q=80';
  const MANGO_IMG = 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&q=80';
  const GINGER_IMG = 'https://images.unsplash.com/photo-1615485925600-97237c4fc1ec?w=600&q=80';
  const TURMERIC_IMG = 'https://images.unsplash.com/photo-1615485291029-a7d3d6c0e87d?w=600&q=80';
  const JACKFRUIT_IMG = 'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=600&q=80';
  const BANANA_IMG = 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80';
  const CHILI_IMG = 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&q=80';
  const CORIANDER_IMG = 'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=600&q=80';

  const productsData = [
    { name: 'Bitter Gourd (Karela)', scientificName: 'Momordica charantia', localName: 'Karela', slug: 'bitter-gourd-karela', category: vegCat._id, subcategorySlug: 'gourds', description: 'Premium quality bitter gourd freshly harvested from Bangladesh. Known for its medicinal properties and rich nutritional content. Our bitter gourds are carefully cultivated without harmful pesticides, ensuring the best quality for both domestic and international markets.', shortDescription: 'Fresh, pesticide-free bitter gourd from Bangladesh farms.', images: [PLACEHOLDER], quantity: 500, unit: 'kg', minimumOrderQuantity: 5, price: 60, discountPrice: 50, priceRangeMin: 0.45, priceRangeMax: 0.65, productCost: 30, harvestingSeason: 'March–October', harvestingMonths: [3,4,5,6,7,8,9,10], isHarvestingSeason: true, allowPreOrder: true, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Jessore, Bangladesh', certifications: [{ name: 'GlobalG.A.P', issuer: 'Control Union', year: '2023' }], isActive: true, isFeatured: true, isOrganic: false, availableForLocal: true, availableForInternational: true, tags: ['bitter gourd', 'karela', 'vegetable', 'medicinal'], storageInstructions: 'Store at 12-13°C with high humidity.', shelfLife: 12 },
    { name: 'Ridge Gourd (Jhinge)', scientificName: 'Luffa acutangula', localName: 'Jhinge', slug: 'ridge-gourd-jhinge', category: vegCat._id, subcategorySlug: 'gourds', description: 'Fresh ridge gourd directly from Bangladesh farms. This tender, nutritious vegetable is a staple in South Asian cuisine and is gaining popularity in international markets for its unique taste and health benefits.', shortDescription: 'Tender ridge gourd for cooking and export.', images: [PLACEHOLDER], quantity: 800, unit: 'kg', minimumOrderQuantity: 10, price: 45, priceRangeMin: 0.35, priceRangeMax: 0.55, productCost: 22, harvestingSeason: 'March–November', harvestingMonths: [3,4,5,6,7,8,9,10,11], isHarvestingSeason: true, allowPreOrder: true, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Faridpur, Bangladesh', isActive: true, isFeatured: true, isOrganic: false, availableForLocal: true, availableForInternational: true, tags: ['ridge gourd', 'jhinge', 'vegetable'], storageInstructions: 'Store at 12-15°C.', shelfLife: 8 },
    { name: 'Snake Gourd', scientificName: 'Trichosanthes cucumerina', localName: 'Chichinga', slug: 'snake-gourd', category: vegCat._id, subcategorySlug: 'gourds', description: 'Long, fresh snake gourds grown in the fertile plains of Bangladesh. Popular across Asia for its low calorie content and rich fiber. Available fresh or in bulk for export.', shortDescription: 'Long, tender snake gourd for Asian cuisine.', images: [PLACEHOLDER], quantity: 600, unit: 'kg', minimumOrderQuantity: 5, price: 40, priceRangeMin: 0.30, priceRangeMax: 0.50, productCost: 18, harvestingSeason: 'April–October', harvestingMonths: [4,5,6,7,8,9,10], isHarvestingSeason: true, allowPreOrder: true, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Comilla, Bangladesh', isActive: true, isFeatured: false, isOrganic: true, availableForLocal: true, availableForInternational: true, tags: ['snake gourd', 'organic', 'vegetable'], shelfLife: 8 },
    { name: 'Pointed Gourd (Potol)', scientificName: 'Trichosanthes dioica', localName: 'Potol', slug: 'pointed-gourd-potol', category: vegCat._id, subcategorySlug: 'gourds', description: 'Pointed gourd (Potol) is a delicate vegetable highly popular in Bangladesh and Eastern India. Rich in vitamins and minerals, it is widely used in both vegetarian and non-vegetarian dishes.', shortDescription: 'Delicate pointed gourd, a Bangladesh specialty.', images: [PLACEHOLDER], quantity: 300, unit: 'kg', minimumOrderQuantity: 5, price: 80, priceRangeMin: 0.65, priceRangeMax: 0.95, productCost: 40, harvestingSeason: 'March–October', harvestingMonths: [3,4,5,6,7,8,9,10], isHarvestingSeason: true, allowPreOrder: true, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Pabna, Bangladesh', isActive: true, isFeatured: true, isOrganic: false, availableForLocal: true, availableForInternational: true, tags: ['pointed gourd', 'potol', 'vegetable', 'bangladesh specialty'] },
    { name: 'Red Amaranth (Lal Shak)', scientificName: 'Amaranthus tricolor', localName: 'Lal Shak', slug: 'red-amaranth-lal-shak', category: vegCat._id, subcategorySlug: 'leafy-greens', description: 'Vibrant red amaranth leaves grown organically in Bangladesh. Packed with iron, calcium, and antioxidants. This leafy green is sought after by Asian grocery chains worldwide.', shortDescription: 'Iron-rich red amaranth leaves, organically grown.', images: [PLACEHOLDER], quantity: 200, unit: 'bundle', minimumOrderQuantity: 20, price: 30, priceRangeMin: 0.80, priceRangeMax: 1.20, productCost: 12, harvestingSeason: 'Year-round', harvestingMonths: [1,2,3,4,5,6,7,8,9,10,11,12], isHarvestingSeason: true, allowPreOrder: false, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Manikganj, Bangladesh', isActive: true, isFeatured: false, isOrganic: true, availableForLocal: true, availableForInternational: true, tags: ['amaranth', 'lal shak', 'leafy green', 'organic', 'iron-rich'] },
    { name: 'Alphonso Mango', scientificName: 'Mangifera indica (Alphonso)', slug: 'alphonso-mango', category: fruitCat._id, subcategorySlug: 'tropical-fruits', description: 'Bangladesh-grown Alphonso mangoes, known for their rich golden colour, sweet aroma, and exceptional taste. Harvested from the mango orchards of Rajshahi and Chapainawabganj. Export-grade packaging available.', shortDescription: 'Premium sweet Alphonso mangoes from Rajshahi.', images: [MANGO_IMG], quantity: 2000, unit: 'kg', minimumOrderQuantity: 20, price: 250, discountPrice: 220, priceRangeMin: 1.50, priceRangeMax: 2.50, productCost: 100, harvestingSeason: 'May–July', harvestingMonths: [5,6,7], isHarvestingSeason: true, allowPreOrder: true, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Rajshahi & Chapainawabganj, Bangladesh', certifications: [{ name: 'Organic Certification', issuer: 'BSTI', year: '2023' }, { name: 'Phytosanitary Certificate', issuer: 'DAE Bangladesh', year: '2024' }], isActive: true, isFeatured: true, isOrganic: true, availableForLocal: true, availableForInternational: true, tags: ['mango', 'alphonso', 'fruit', 'export', 'seasonal', 'organic'], storageInstructions: 'Store at 8-10°C. Do not refrigerate unripe mangoes.', shelfLife: 18 },
    { name: 'Green Banana (Kanchkala)', scientificName: 'Musa acuminata', localName: 'Kanchkala', slug: 'green-banana-kanchkala', category: fruitCat._id, subcategorySlug: 'other-fruits', description: 'Fresh green bananas (Kanchkala) used in cooking across South and Southeast Asia. Rich in resistant starch and fibre, green bananas are increasingly popular in health food markets globally.', shortDescription: 'Cooking bananas, rich in starch and fibre.', images: [BANANA_IMG], quantity: 3000, unit: 'kg', minimumOrderQuantity: 50, price: 35, priceRangeMin: 0.28, priceRangeMax: 0.45, productCost: 15, harvestingSeason: 'Year-round', harvestingMonths: [1,2,3,4,5,6,7,8,9,10,11,12], isHarvestingSeason: true, allowPreOrder: false, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Munshiganj, Bangladesh', isActive: true, isFeatured: false, isOrganic: false, availableForLocal: true, availableForInternational: true, tags: ['banana', 'green banana', 'kanchkala', 'cooking', 'starch'], shelfLife: 12 },
    { name: 'Jackfruit (Kathal)', scientificName: 'Artocarpus heterophyllus', localName: 'Kathal', slug: 'jackfruit-kathal', category: fruitCat._id, subcategorySlug: 'tropical-fruits', description: 'Bangladesh is one of the world\'s largest producers of jackfruit – the national fruit. Our jackfruits are harvested at peak ripeness from ancient trees. Both ripe sweet and raw (vegetable) jackfruit available in bulk for export.', shortDescription: 'Bangladesh\'s national fruit – sweet and nutritious.', images: [JACKFRUIT_IMG], quantity: 500, unit: 'piece', minimumOrderQuantity: 10, price: 180, priceRangeMin: 1.20, priceRangeMax: 2.00, productCost: 70, harvestingSeason: 'April–August', harvestingMonths: [4,5,6,7,8], isHarvestingSeason: true, allowPreOrder: true, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Gazipur, Bangladesh', isActive: true, isFeatured: true, isOrganic: false, availableForLocal: true, availableForInternational: true, tags: ['jackfruit', 'kathal', 'national fruit', 'tropical', 'vegan'], storageInstructions: 'Whole fruit at room temperature. Cut pieces refrigerated.', shelfLife: 7 },
    { name: 'Fresh Ginger Root', scientificName: 'Zingiber officinale', localName: 'Ada', slug: 'fresh-ginger-root', category: herbCat._id, subcategorySlug: 'spice-roots', description: 'High-quality fresh ginger root from the hills of Bangladesh. Our ginger has a strong aromatic flavour and high essential oil content, making it ideal for both culinary and pharmaceutical industries. HACCP certified for international export.', shortDescription: 'Aromatic, high oil content ginger for export.', images: [GINGER_IMG], quantity: 5000, unit: 'kg', minimumOrderQuantity: 100, price: 120, priceRangeMin: 0.80, priceRangeMax: 1.40, productCost: 55, harvestingSeason: 'November–February', harvestingMonths: [11,12,1,2], isHarvestingSeason: false, allowPreOrder: true, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Tangail & Jamalpur, Bangladesh', certifications: [{ name: 'HACCP', issuer: 'SGS Bangladesh', year: '2023' }, { name: 'ISO 22000', issuer: 'Bureau Veritas', year: '2023' }], isActive: true, isFeatured: true, isOrganic: false, availableForLocal: true, availableForInternational: true, tags: ['ginger', 'spice', 'herb', 'export', 'HACCP', 'pharmaceutical'], storageInstructions: 'Store in cool, dry place. Refrigerate for longer shelf life.', shelfLife: 25 },
    { name: 'Turmeric Root', scientificName: 'Curcuma longa', localName: 'Holud', slug: 'turmeric-root', category: herbCat._id, subcategorySlug: 'spice-roots', description: 'Bangladesh turmeric is globally recognised for its high curcumin content (5-7%). Our Lakadong variety turmeric is sourced from traditional farms and is in high demand in the nutraceutical and cosmetic industries worldwide.', shortDescription: 'High curcumin turmeric for food & pharmaceutical use.', images: [TURMERIC_IMG], quantity: 8000, unit: 'kg', minimumOrderQuantity: 100, price: 100, priceRangeMin: 0.70, priceRangeMax: 1.20, productCost: 45, harvestingSeason: 'January–March', harvestingMonths: [1,2,3], isHarvestingSeason: false, allowPreOrder: true, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Comilla & Sylhet, Bangladesh', certifications: [{ name: 'Organic Certification', issuer: 'Control Union', year: '2023' }, { name: 'HACCP', issuer: 'SGS Bangladesh', year: '2023' }], isActive: true, isFeatured: true, isOrganic: true, availableForLocal: true, availableForInternational: true, tags: ['turmeric', 'curcumin', 'spice', 'organic', 'nutraceutical', 'export'], storageInstructions: 'Keep in cool, dark, dry place.', shelfLife: 365 },
    { name: 'Green Chili', scientificName: 'Capsicum annuum', localName: 'Kacha Morich', slug: 'green-chili', category: vegCat._id, subcategorySlug: 'gourds', description: 'Fresh, pungent green chilies from Bangladesh, known for their vibrant colour and consistent heat level. Available in multiple varieties for both food processing and fresh market exports.', shortDescription: 'Pungent green chilies for cooking and processing.', images: [CHILI_IMG], quantity: 1000, unit: 'kg', minimumOrderQuantity: 10, price: 80, priceRangeMin: 0.55, priceRangeMax: 0.85, productCost: 35, harvestingSeason: 'Year-round', harvestingMonths: [1,2,3,4,5,6,7,8,9,10,11,12], isHarvestingSeason: true, allowPreOrder: false, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Bogura, Bangladesh', isActive: true, isFeatured: false, isOrganic: false, availableForLocal: true, availableForInternational: true, tags: ['chili', 'spice', 'pepper', 'hot'], shelfLife: 8 },
    { name: 'Fresh Coriander (Dhania)', scientificName: 'Coriandrum sativum', localName: 'Dhania', slug: 'fresh-coriander-dhania', category: herbCat._id, subcategorySlug: 'fresh-herbs', description: 'Fresh coriander bundles with vibrant green leaves and aromatic fragrance. Essential ingredient in Asian and Middle Eastern cooking. Available in IQF frozen form for international markets.', shortDescription: 'Aromatic fresh coriander, export-ready IQF available.', images: [CORIANDER_IMG], quantity: 400, unit: 'bundle', minimumOrderQuantity: 50, price: 20, priceRangeMin: 0.45, priceRangeMax: 0.75, productCost: 8, harvestingSeason: 'November–March', harvestingMonths: [11,12,1,2,3], isHarvestingSeason: false, allowPreOrder: true, countryOfOrigin: 'Bangladesh', harvestingLocation: 'Natore, Bangladesh', isActive: true, isFeatured: false, isOrganic: false, availableForLocal: true, availableForInternational: true, tags: ['coriander', 'dhania', 'herb', 'fresh', 'IQF', 'frozen'], shelfLife: 6 },
  ];

  const products = await Product.insertMany(productsData);
  console.log(`   ✅ ${products.length} products created`);

  // ── INVENTORY ────────────────────────────────────────────
  console.log('📦 Creating inventory records...');
  const inventoryData = products.map(p => ({ product: p._id, currentStock: p.quantity, reservedStock: 0, availableStock: p.quantity, minimumStockAlert: Math.max(10, Math.floor(p.quantity * 0.1)), lastRestocked: new Date(), lastRestockedQuantity: p.quantity, transactions: [{ type: 'in', quantity: p.quantity, reason: 'Initial stock from seed', timestamp: new Date() }] }));
  await Inventory.insertMany(inventoryData);
  console.log(`   ✅ ${inventoryData.length} inventory records created`);

  // ── BANNERS ──────────────────────────────────────────────
  console.log('🖼️  Creating banners...');
  await Banner.insertMany([
    { title: 'Farm Fresh from Bangladesh', subtitle: 'Premium quality vegetables & fruits, directly to your door', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&q=80', link: '/products', buttonText: 'Shop Now', type: 'hero', position: 'home', isActive: true, displayOrder: 1, targetAudience: 'local' },
    { title: 'Global Import Solutions', subtitle: 'Bulk fresh produce from Bangladesh for your international business', image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1400&q=80', link: '/products', buttonText: 'Request Quotation', type: 'hero', position: 'home', isActive: true, displayOrder: 2, targetAudience: 'international' },
  ]);
  console.log('   ✅ 2 banners created');

  // ── FLASH SALE ───────────────────────────────────────────
  console.log('⚡ Creating flash sale...');
  const now = new Date();
  const saleEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const [gourd, mango, ginger] = products;
  await FlashSale.create({ title: '48-Hour Harvest Special!', description: 'Fresh from the farm, limited time offer', items: [{ product: gourd._id, salePrice: 40, discountPercentage: 20 }, { product: mango._id, salePrice: 180, discountPercentage: 18 }, { product: ginger._id, salePrice: 95, discountPercentage: 21 }], startTime: now, endTime: saleEnd, isActive: true, targetAudience: 'local' });
  console.log('   ✅ 1 flash sale created');

  // ── COUPONS ──────────────────────────────────────────────
  console.log('🏷️  Creating coupons...');
  const couponExpiry = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  await Coupon.insertMany([
    { code: 'WELCOME10', description: 'New customer discount', type: 'percentage', value: 10, minimumOrderAmount: 200, maximumDiscount: 100, usageLimit: 500, usedCount: 0, validFrom: now, validUntil: couponExpiry, isActive: true, applicableFor: 'local' },
    { code: 'FRESH20', description: 'Special 20% off for returning customers', type: 'percentage', value: 20, minimumOrderAmount: 500, maximumDiscount: 200, usageLimit: 100, usedCount: 0, validFrom: now, validUntil: couponExpiry, isActive: true, applicableFor: 'all' },
    { code: 'SAVE100', description: 'Flat ৳100 off on orders above ৳800', type: 'fixed', value: 100, minimumOrderAmount: 800, usageLimit: 200, usedCount: 0, validFrom: now, validUntil: couponExpiry, isActive: true, applicableFor: 'local' },
  ]);
  console.log('   ✅ 3 coupons created');

  // ── SPECIAL SECTIONS ─────────────────────────────────────
  console.log('🎯 Creating special sections...');
  const featuredProds = products.filter(p => p.isFeatured).map(p => p._id);
  const organicProds = products.filter(p => p.isOrganic).map(p => p._id);
  await SpecialSection.insertMany([
    { title: 'Export Bestsellers', description: 'Our most demanded products by international buyers', badge: '🌍 Top Export', products: featuredProds.slice(0, 6), isActive: true, position: 'home', displayOrder: 1, targetAudience: 'international' },
    { title: 'Certified Organic', description: 'Pesticide-free, organically certified produce', badge: '🌿 Organic', products: organicProds.slice(0, 5), isActive: true, position: 'both', displayOrder: 2, targetAudience: 'all' },
    { title: 'Seasonal Picks', description: 'Best of this harvest season', badge: '🌾 In Season', products: products.filter(p => p.isHarvestingSeason).map(p => p._id).slice(0, 6), isActive: true, position: 'home', displayOrder: 3, targetAudience: 'all' },
  ]);
  console.log('   ✅ 3 special sections created');

  // ── SETTINGS ─────────────────────────────────────────────
  console.log('⚙️  Creating site settings...');
  await Settings.create({
    siteTitle: 'Shah International', siteTagline: 'Farm Fresh. Global Reach.', siteDescription: 'Premium farm-fresh vegetables and fruits exported from Bangladesh to the world.',
    activeTheme: 'green', activeLanguage: 'en', localDeliveryCharge: 60, freeDeliveryAbove: 1000, vatPercentage: 0,
    contact: { phone: '+8801700000000', whatsapp: '+8801700000000', email: 'info@shahintl.com', exportEmail: 'export@shahintl.com', address: 'Dhaka, Bangladesh' },
    social: { facebook: 'https://facebook.com/shahintl', instagram: 'https://instagram.com/shahintl', linkedin: 'https://linkedin.com/company/shahintl' },
    footerSections: [{ title: 'Quick Links', links: [{ title: 'Home', url: '/' }, { title: 'Products', url: '/products' }, { title: 'About Us', url: '/about' }] }, { title: 'For Importers', links: [{ title: 'Export Process', url: '#' }, { title: 'Certifications', url: '#' }] }],
    aboutUs: 'Shah International is a leading agro-export company based in Bangladesh, dedicated to providing premium quality farm-fresh vegetables, fruits, and herbs to global markets.',
  });
  console.log('   ✅ Settings created');

  // ── CURRENCY RATES ───────────────────────────────────────
  console.log('💱 Seeding currency rates...');
  await CurrencyRate.create({ base: 'USD', rates: { USD: 1, BDT: 110, EUR: 0.92, GBP: 0.79, INR: 83.5, PKR: 278, AED: 3.67, SAR: 3.75 }, lastUpdated: new Date() });
  console.log('   ✅ Currency rates seeded');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅  DATABASE SEEDED SUCCESSFULLY!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Demo Login Credentials:');
  console.log('──────────────────────────────────────────');
  console.log('Super Admin : admin@shahintl.com      / SuperAdmin123!');
  console.log('Admin       : manager@shahintl.com    / Admin123!');
  console.log('Editor      : editor@shahintl.com     / Editor123!');
  console.log('Local #1    : rahul.bd@test.com       / Test123!');
  console.log('Local #2    : fatima.bd@test.com      / Test123!');
  console.log('Intl  #1    : john.importer@test.com  / Test123!');
  console.log('Intl  #2    : sarah.eu@test.com       / Test123!');
  console.log('──────────────────────────────────────────\n');
  console.log('Coupon Codes: WELCOME10 | FRESH20 | SAVE100\n');

  await mongoose.disconnect();
}

seed().catch(e => { console.error('❌ Seed failed:', e); process.exit(1); });
