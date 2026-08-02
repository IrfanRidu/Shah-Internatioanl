import mongoose from 'mongoose';

// Requirement 6 (Bank Account Configuration) — admin-managed list of the company's own bank
// accounts. A shipment selects one (ExportShipment.bankAccount ref) and its 5 fields auto-fill
// into that shipment's own beneficiaryBank/accountNo/branchName/bankAddress/routingNo/swiftCode
// fields (which stay independently editable afterward, same "auto-fill then detach" pattern used
// elsewhere in this editor, e.g. botanical name from product selection).
const ExportBankAccountSchema = new mongoose.Schema({
  beneficiaryBank: { type: String, required: true }, // Bank Account Name
  accountNo: { type: String, required: true },
  branch: { type: String, required: true },
  bankAddress: { type: String, required: true },
  routingNo: { type: String, required: true },
  swiftCode: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.models.ExportBankAccount || mongoose.model('ExportBankAccount', ExportBankAccountSchema);
