import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Server } from 'socket.io';
import http from 'http';
import cron from 'node-cron';

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
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

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

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Join user-specific room based on userId
  socket.on('join', (userId: string) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Schedule deadline reminders (example for students)
cron.schedule('0 9 * * *', async () => { // Every day at 9 AM
  console.log('Sending deadline reminder notifications');
  await notifyUsers(
    'Deadline Reminder',
    'Don’t forget: Assignment due soon!',
    'student'
  );
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/collegenews';

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Function to notify users (for use in routes)
const notifyUsers = async (title: string, body: string, role: string, newsId?: string) => {
  const users = await mongoose.model('User').find({ role });
  const notifications = users.map(async (user: any) => {
    const notification = new (mongoose.model('Notification'))({
      userId: user._id,
      title,
      body,
      role,
      read: false,
      newsId,
    });
    await notification.save();
    io.to(user._id).emit('notification', notification);
    return notification;
  });
  await Promise.all(notifications);
};