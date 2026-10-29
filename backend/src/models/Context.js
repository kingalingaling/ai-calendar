import mongoose from 'mongoose';

const workingHoursSchema = new mongoose.Schema(
  {
    start: { type: String, default: '09:00' },
    end: { type: String, default: '17:00' },
    days: { type: [Number], default: [1, 2, 3, 4, 5] },
  },
  { _id: false }
);

const contextSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#3b82f6' },
    icon: { type: String, default: 'briefcase' },
    isDefault: { type: Boolean, default: false },
    workingHours: {
      type: workingHoursSchema,
      default: () => ({ start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }),
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

// Virtual id for lean queries
contextSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const Context = mongoose.models.Context || mongoose.model('Context', contextSchema);
