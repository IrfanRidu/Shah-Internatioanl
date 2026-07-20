import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const AddressSchema = new mongoose.Schema({
  street: String,
  area: String,
  city: String,
  district: String,
  zipCode: String,
  country: { type: String, default: 'Bangladesh' },
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  password: { type: String, select: false },
  role: {
    type: String,
    enum: ['superAdmin', 'admin', 'editor', 'localBuyer', 'internationalBuyer'],
    default: 'localBuyer',
  },
  buyerType: { type: String, enum: ['local', 'international'], default: 'local' },
  adminRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  avatar: { type: String, default: '' },
  company: { type: String },
  country: { type: String, default: 'Bangladesh' },
  address: AddressSchema,
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerifyToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  provider: { type: String, default: 'credentials' },
  providerId: String,
  notes: String,
  marketingOptIn: { type: Boolean, default: false },
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.emailVerifyToken;
  return obj;
};

export default mongoose.models.User || mongoose.model('User', UserSchema);
