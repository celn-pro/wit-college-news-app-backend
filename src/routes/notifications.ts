import express, { Request, Response } from 'express';
import Notification, { INotification } from '../models/Notification';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get user's notifications
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user;
  console.log('Get notifications request: userId=', user?._id);

  try {
    const notifications = await Notification.find({ userId: user?._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error: any) {
    console.error('Error fetching notifications:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark a notification as read
router.post('/mark-read/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  console.log('Mark notification read request: userId=', user?._id, 'notificationId=', id);

  try {
    const notification = await Notification.findOne({ _id: id, userId: user?._id });
    if (!notification) {
       res.status(404).json({ message: 'Notification not found' });
       return;
    }
    notification.read = true;
    await notification.save();
    res.json(notification);
  } catch (error: any) {
    console.error('Error marking notification as read:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user;
  console.log('Mark all notifications read request: userId=', user?._id);

  try {
    await Notification.updateMany(
      { userId: user?._id, read: false },
      { read: true }
    );
    const notifications = await Notification.find({ userId: user?._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;