import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  createdBy: string;
  createdAt: Date;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true },
  createdBy: { type: String, required: true }, // admin userId
}, { timestamps: true });

export default mongoose.model<ICategory>('Category', categorySchema);