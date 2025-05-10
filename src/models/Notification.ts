import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: string;
  title: string;
  body: string;
  role: string;
  read: boolean;
  createdAt: Date;
  newsId?: string;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  role: { type: String, required: true, enum: ['all', 'student', 'faculty', 'admin'] },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  newsId: { type: String, required: false },
});

export default mongoose.model<INotification>('Notification', NotificationSchema);