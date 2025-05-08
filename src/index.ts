import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import newsRouter from './routes/news';
import notificationRouter from './routes/notifications';
import authRouter from './routes/auth';
import facultyCodeRoutes from './routes/facultyCode';
import categoryRoutes from './routes/categories';
import userRouter from './routes/users';
import userPreferencesRouter from './routes/userPreferences';
import commentRoutes from './routes/comments';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/news', newsRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/auth', authRouter);
app.use('/api/faculty-code', facultyCodeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRouter);
app.use('/api/userpreferences', userPreferencesRouter);
app.use('/api/comments', commentRoutes);

// Express (app.js)
app.use('/assets/news-images', express.static(path.join(__dirname, '..', 'assets', 'news-images')));

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/collegenews';

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));