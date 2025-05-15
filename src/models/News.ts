import mongoose, { Schema, Document } from 'mongoose';

export interface INews extends Document {
  title: string;
  content: string;
  category: string;
  image?: string;
  role: 'all' | 'student' | 'faculty';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;  // ✅ Add this
  likeCount: number;
  viewCount: number;
  likedBy: string[];
  viewedBy: string[];
}

const newsSchema = new Schema<INews>(
  {
    title: { type: String, required: true, maxlength: 100 },
    content: { type: String, required: true, maxlength: 5000 },
    category: { type: String, required: true },
    image: { type: String },
    role: { type: String, enum: ['all', 'student', 'faculty'], default: 'all' },
    createdBy: { type: String, required: true },
    likeCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    likedBy: [{ type: String }],
    viewedBy: [{ type: String }],
  },
  { timestamps: true } // ✅ enables createdAt and updatedAt automatically
);

export default mongoose.model<INews>('News', newsSchema);
