import mongoose from 'mongoose';

const xpLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    taskId: { type: String, default: null },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export const XpLog = mongoose.models.XpLog || mongoose.model('XpLog', xpLogSchema);
