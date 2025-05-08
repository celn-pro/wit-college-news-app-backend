import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPreferences extends Document {
  userId: string;
  archivedNewsIds: string[];
  selectedCategories: string[];
  updatedAt: any;
}

const userPreferencesSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  selectedCategories: {
    type: [String],
    default: []
  },
  archivedNewsIds: {
    type: [String],
    default: []
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IUserPreferences>('UserPreferences', userPreferencesSchema);