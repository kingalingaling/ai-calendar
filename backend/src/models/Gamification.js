import mongoose from 'mongoose';

const gamificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: 'global_user',
    },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    streakCount: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: String, default: null },
    streakFreezesAvailable: { type: Number, default: 2 },
    unlockedBadges: { type: [String], default: [] },
    currentTheme: { type: String, default: 'emerald' },
    dailyStaminaMax: { type: Number, default: 100 },
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

export const Gamification = mongoose.models.Gamification || mongoose.model('Gamification', gamificationSchema);
