import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  password: string;
  email: string;
  role: 'student' | 'faculty' | 'admin';
  isAdmin: boolean;
  lastLogin?: Date;
  selectedCategories?: string[];
}

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['student', 'faculty', 'admin'], default: 'student' },
  isAdmin: { type: Boolean, default: false },
  lastLogin: { type: Date },
  selectedCategories: [{ type: String }],
}, { timestamps: true });

export default mongoose.model<IUser>('User', userSchema);