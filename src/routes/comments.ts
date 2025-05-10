import express, { Request, Response } from 'express';
import Comment, { IComment } from '../models/Comment';
import News from '../models/News';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import Notification from '../models/Notification';
import { io } from '../index'; // Import Socket.IO instance

const router = express.Router();

// Notify user
const notifyUser = async (userId: string, title: string, body: string, role: string, newsId?: string) => {
  const notification = new Notification({
    userId,
    title,
    body,
    role,
    read: false,
    newsId,
  });
  await notification.save();
  io.to(userId).emit('notification', notification);
};

// Add comment
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { newsId, content } = req.body;
  const user = req.user;
  console.log('Add comment request: userId=', user?._id, 'newsId=', newsId);

  if (!newsId || !content) {
    console.log('Missing required fields: newsId=', newsId, 'content=', !!content);
     res.status(400).json({ message: 'News ID and content are required' });
     return;
  }

  if (content.length > 500) {
    console.log('Comment too long:', content.length);
     res.status(400).json({ message: 'Comment must be 500 characters or less' });
     return;
  }

  try {
    const news = await News.findById(newsId);
    if (!news) {
      console.log('News not found:', newsId);
       res.status(404).json({ message: 'News not found' });
       return;
    }
    const comment: IComment = new Comment({
      newsId,
      userId: user!._id,
      username: user!.username,
      content,
    });

    await comment.save();
    console.log('Comment created: id=', comment._id, 'newsId=', newsId);

    // Notify the news creator if they are not the commenter
    if (news.createdBy !== user!._id) {
      await notifyUser(
        news.createdBy,
        'New Comment',
        `${user!.username} commented on your post: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
        user!.role,
        newsId
      );
    }

    res.status(201).json({
      _id: comment._id,
      newsId: comment.newsId,
      userId: comment.userId,
      username: comment.username,
      content: comment.content,
      createdAt: comment.createdAt,
    });
  } catch (error: any) {
    console.error('Error creating comment:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get comments for a news item
router.get('/:newsId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { newsId } = req.params;
  console.log('Get comments request: newsId=', newsId);

  try {
    const comments = await Comment.find({ newsId }).sort({ createdAt: -1 });
    console.log('Fetched comments:', comments.length);
    res.json(comments);
  } catch (error: any) {
    console.error('Error fetching comments:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;