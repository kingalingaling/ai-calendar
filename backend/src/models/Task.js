import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    userId: { type: String, default: 'global_user', index: true },
    contextId: { type: String, required: true, index: true },
    projectId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'waiting_for', 'done'],
      default: 'todo',
      index: true,
    },
    waitingReason: { type: String, default: null },
    waitingSince: { type: Date, default: null },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    estimatedMinutes: { type: Number, default: 30 },
    dueDate: { type: String, default: null },
    scheduledStart: { type: String, default: null },
    scheduledEnd: { type: String, default: null },
    calendarEventId: { type: String, default: null },
    calendarTaskId: { type: String, default: null },
    source: { type: String, default: 'manual' },
    xpValue: { type: Number, default: 25 },
    energyCost: { type: Number, default: 1 },
    completedAt: { type: Date, default: null },
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

export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
