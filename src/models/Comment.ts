import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  newsId: string;
  userId: string;
  username: string;
  content: string;
  createdAt: Date;
}

const commentSchema = new Schema<IComment>({
  newsId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  content: { type: String, required: true, maxlength: 500 },
}, { timestamps: true });

export default mongoose.model<IComment>('Comment', commentSchema);