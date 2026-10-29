import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    userId: { type: String, default: 'global_user', index: true },
    contextId: { type: String, required: true, index: true },
    parentId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    color: { type: String, default: null },
    milestoneDate: { type: String, default: null },
    status: {
      type: String,
      enum: ['active', 'completed', 'on_hold', 'archived'],
      default: 'active',
    },
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
