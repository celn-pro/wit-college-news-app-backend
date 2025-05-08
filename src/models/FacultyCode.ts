import mongoose, { Schema, Document } from 'mongoose';

export interface IFacultyCode extends Document {
  code: string;
  email: string;
  used: boolean;
  expiresAt: Date;
}

const facultyCodeSchema = new Schema<IFacultyCode>({
  code: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

export default mongoose.model<IFacultyCode>('FacultyCode', facultyCodeSchema);