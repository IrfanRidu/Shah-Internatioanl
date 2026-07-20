import mongoose from 'mongoose';

const PermissionSchema = new mongoose.Schema({
  module: String,
  actions: [String],
});

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  permissions: {
    products: { view: Boolean, create: Boolean, edit: Boolean, delete: Boolean },
    categories: { view: Boolean, create: Boolean, edit: Boolean, delete: Boolean },
    orders: { view: Boolean, update: Boolean, cancel: Boolean },
    customers: { view: Boolean, export: Boolean },
    analytics: { view: Boolean },
    banners: { view: Boolean, create: Boolean, edit: Boolean, delete: Boolean },
    flashSales: { view: Boolean, create: Boolean, edit: Boolean, delete: Boolean },
    coupons: { view: Boolean, create: Boolean, edit: Boolean, delete: Boolean },
    settings: { view: Boolean, edit: Boolean },
    inventory: { view: Boolean, edit: Boolean },
    roles: { view: Boolean, create: Boolean, edit: Boolean, delete: Boolean },
    sections: { view: Boolean, create: Boolean, edit: Boolean, delete: Boolean },
    pages: { view: Boolean, create: Boolean, edit: Boolean, delete: Boolean },
    marketing: { view: Boolean, send: Boolean },
    reviews: { view: Boolean, moderate: Boolean },
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.models.Role || mongoose.model('Role', RoleSchema);
