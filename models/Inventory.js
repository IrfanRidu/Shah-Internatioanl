import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['in', 'out', 'adjustment', 'reserved', 'released'] },
  quantity: Number,
  reason: String,
  reference: String,
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
});

const InventorySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
  currentStock: { type: Number, default: 0 },
  reservedStock: { type: Number, default: 0 },
  availableStock: { type: Number, default: 0 },
  minimumStockAlert: { type: Number, default: 10 },
  transactions: [TransactionSchema],
  lastRestocked: Date,
  lastRestockedQuantity: Number,
}, { timestamps: true });

InventorySchema.pre('save', function (next) {
  this.availableStock = this.currentStock - this.reservedStock;
  next();
});

export default mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);
