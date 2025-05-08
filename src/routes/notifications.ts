import express from 'express';
import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.model('Notification', NotificationSchema);

const router = express.Router();

router.get('/', async (req, res) => {
  const { userId } = req.query;
  try {
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;