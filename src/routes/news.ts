import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import News, { INews } from '../models/News';
import UserPreferences from '../models/UserPreferences';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { IUserPreferences } from '../models/UserPreferences';
import Notification from '../models/Notification';
import { io } from '../index';
import cloudinary from '../config/cloudinary';
import streamifier from 'streamifier';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const router = Router();

// Notify users based on role
const notifyUsers = async (title: string, body: string, role: string, newsId?: string) => {
  const users = role === 'all'
    ? await mongoose.model('User').find({})
    : await mongoose.model('User').find({ role });
  const notifications = users.map(async (user: any) => {
    const notification = new Notification({
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

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../assets/news-images');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  },
});

// Upload image
router.post('/upload-image', authMiddleware, upload.single('image'), async (req: AuthRequest, res) => {
  const user = req.user;
  console.log('Upload image request: userId=', user?._id);

  if (!req.file) {
    res.status(400).json({ message: 'No image uploaded' });
    return;
  }

  try {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'college-news',
        public_id: uuidv4(),
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          res.status(500).json({ message: 'Upload failed' });
          return;
        }
        console.log('Image uploaded to Cloudinary:', result?.secure_url);
        res.json({ imageUrl: result?.secure_url });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (error) {
    console.error('Unexpected error uploading image:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create news
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, content, category, image, role } = req.body;
  const user = req.user;
  console.log('Create news request: userId=', user?._id, 'title=', title);

  if (!title || !content || !category) {
    console.log('Missing required fields: title=', title, 'content=', !!content, 'category=', category);
    res.status(400).json({ message: 'Title, content, and category are required' });
    return;
  }

  if (title.length > 100) {
    console.log('Title too long:', title.length);
    res.status(400).json({ message: 'Title must be 100 characters or less' });
    return;
  }

  if (content.length > 5000) {
    console.log('Content too long:', content.length);
    res.status(400).json({ message: 'Content must be 5000 characters or less' });
    return;
  }

  if (role && !['all', 'student', 'faculty'].includes(role)) {
    console.log('Invalid role:', role);
    res.status(400).json({ message: 'Invalid role' });
    return;
  }

  try {
    const news: INews = new News({
      title,
      content,
      category,
      image,
      role: role || 'all',
      createdBy: user!._id,
    });

    await news.save();
    console.log('News created: id=', news._id, 'title=', title);

    await notifyUsers(
      'New News Post',
      `A new post "${title}" has been added.`,
      news.role,
      String(news._id)
    );

    res.status(201).json({
      _id: news._id,
      title: news.title,
      content: news.content,
      category: news.category,
      image: news.image,
      role: news.role,
      createdBy: news.createdBy,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
      likeCount: news.likeCount,
      viewCount: news.viewCount,
      likedBy: news.likedBy,
      viewedBy: news.viewedBy,
    });
  } catch (error: any) {
    console.error('Error creating news:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete news
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  console.log('Delete news request: userId=', user?._id, 'newsId=', id);

  if (user?.role !== 'admin') {
    console.log('Unauthorized: userRole=', user?.role);
    res.status(403).json({ message: 'Only admins can delete news' });
    return;
  }

  try {
    const news = await News.findById(id);
    if (!news) {
      console.log('News not found:', id);
      res.status(404).json({ message: 'News not found' });
      return;
    }

    await news.deleteOne();
    console.log('News deleted: id=', id);

    // Notify users about deletion
    await notifyUsers(
      'News Deleted',
      `The post "${news.title}" has been deleted.`,
      news.role,
      String(news._id)
    );

    // Remove news from all users' archivedNewsIds
    await UserPreferences.updateMany(
      { archivedNewsIds: id },
      { $pull: { archivedNewsIds: id } }
    );

    res.json({ message: 'News deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting news:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search news, excluding user's archived news
router.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { q, role, category, since } = req.query;
  const userId = req.user?._id;
  console.log('Search request: q=', q, 'role=', role, 'category=', category, 'since=', since, 'userId=', userId);

  if (!userId) {
    console.log('Missing userId in request');
    res.status(401).json({ message: 'User not authenticated' });
    return;
  }

  if (!q) {
    console.log('Missing search query');
    res.status(400).json({ error: 'Search query (q) is required' });
    return;
  }

  try {
    let query: any = { $text: { $search: q as string } };
    if (role) {
      query.$or = [{ role }, { role: 'all' }];
    } else {
      query.role = 'all';
    }
    if (category) {
      query.category = { $regex: category as string, $options: 'i' };
    }
    if (since) {
      const sinceDate = new Date(since as string);
      if (isNaN(sinceDate.getTime())) {
        console.log('Invalid since date:', since);
        res.status(400).json({ message: 'Invalid since date' });
        return;
      }
      query.$or = [
        { createdAt: { $gt: sinceDate } },
        { updatedAt: { $gt: sinceDate } },
      ];
    }

    const preferences = await UserPreferences.findOne({ userId });
    const archivedNewsIds = preferences?.archivedNewsIds || [];
    query._id = { $nin: archivedNewsIds };

    const news = await News.find(query).sort({ createdAt: -1 });
    console.log('Search results:', news.length);
    res.json(news);
  } catch (error: any) {
    console.error('Error searching news:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch user's archived news
router.get('/archived', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { role, since } = req.query;
  const userId = req.user?._id;
  console.log('Fetching archived news, role:', role, 'since:', since, 'userId:', userId);

  if (!userId) {
    console.log('Missing userId in request');
     res.status(401).json({ message: 'User not authenticated' });
     return;
  }

  try {
    const preferences = await UserPreferences.findOne({ userId });
    const archivedNewsIds = preferences?.archivedNewsIds || [];
    console.log('Archived news IDs:', archivedNewsIds);

    const validNewsIds = archivedNewsIds.filter((id) => mongoose.isValidObjectId(id));
    if (archivedNewsIds.length !== validNewsIds.length) {
      console.warn('Invalid ObjectIds found in archivedNewsIds:', archivedNewsIds);
    }

    if (validNewsIds.length === 0) {
      console.log('No valid archived news IDs');
       res.json([]);
       return;
    }

    const query: any = { _id: { $in: validNewsIds } };
    if (role !== 'admin') {
      query.category = { $in: ['General', 'Sports', 'Events', 'Academics'] };
    }
    if (since) {
      const sinceDate = new Date(since as string);
      if (isNaN(sinceDate.getTime())) {
        console.log('Invalid since date:', since);
         res.status(400).json({ message: 'Invalid since date' });
         return;
      }
      query.$or = [
        { createdAt: { $gt: sinceDate } },
        { updatedAt: { $gt: sinceDate } },
      ];
    }

    const news = await News.find(query).sort({ createdAt: -1 });
    console.log('Fetched archived news:', news.length);
    res.json(news);
  } catch (error: any) {
    console.error('Error fetching archived news:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all news
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { role, category, since, includeArchived } = req.query;
  const user = req.user;
  console.log('Get news request: userId=', user?._id, 'role=', role, 'category=', category, 'since=', since, 'includeArchived=', includeArchived);

  try {
    const query: any = {};
    if (user?.role !== 'admin') {
      query.$or = [{ role: 'all' }, { role: user?.role }];
    }
    if (category) {
      query.category = { $regex: category as string, $options: 'i' };
    }
    if (since) {
      const sinceDate = new Date(since as string);
      if (isNaN(sinceDate.getTime())) {
        console.log('Invalid since date:', since);
         res.status(400).json({ message: 'Invalid since date' });
         return;
      }
      query.$or = [
        { createdAt: { $gt: sinceDate } },
        { updatedAt: { $gt: sinceDate } },
      ];
    }

    // Only exclude archived news if includeArchived is not true
    if (includeArchived !== 'true') {
      const preferences = await UserPreferences.findOne({ userId: user?._id });
      const archivedNewsIds = preferences?.archivedNewsIds || [];
      query._id = { $nin: archivedNewsIds };
    }

    const news = await News.find(query).sort({ createdAt: -1 });
    console.log('Fetched news:', news.length);
    res.json(news);
  } catch (error: any) {
    console.error('Error fetching news:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get news by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  console.log('Get news by ID request: userId=', user?._id, 'newsId=', id);

  try {
    const news = await News.findById(id);
    if (!news) {
      console.log('News not found:', id);
      res.status(404).json({ message: 'News not found' });
      return;
    }

    if (user?.role !== 'admin' && !['all', user?.role].includes(news.role)) {
      console.log('Unauthorized access: userRole=', user?.role, 'newsRole=', news.role);
      res.status(403).json({ message: 'Unauthorized' });
      return;
    }

    console.log('Fetched news:', news._id);
    res.json({
      _id: news._id,
      title: news.title,
      content: news.content,
      category: news.category,
      image: news.image,
      role: news.role,
      createdBy: news.createdBy,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
      likeCount: news.likeCount,
      viewCount: news.viewCount,
      likedBy: news.likedBy,
      viewedBy: news.viewedBy,
    });
  } catch (error: any) {
    console.error('Error fetching news by ID:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update news
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { title, content, image } = req.body;
  const user = req.user;
  console.log('Update news request: userId=', user?._id, 'newsId=', id);

  if (user?.role !== 'admin') {
    console.log('Unauthorized: userRole=', user?.role);
    res.status(403).json({ message: 'Only admins can update news' });
    return;
  }

  if (!title || !content) {
    console.log('Missing required fields: title=', title, 'content=', !!content);
    res.status(400).json({ message: 'Title and content are required' });
    return;
  }

  if (title.length > 100) {
    console.log('Title too long:', title.length);
    res.status(400).json({ message: 'Title must be 100 characters or less' });
    return;
  }

  if (content.length > 5000) {
    console.log('Content too long:', content.length);
    res.status(400).json({ message: 'Content must be 5000 characters or less' });
    return;
  }

  try {
    const news = await News.findById(id);
    if (!news) {
      console.log('News not found:', id);
      res.status(404).json({ message: 'News not found' });
      return;
    }

    news.title = title;
    news.content = content;
    if (image) news.image = image;
    await news.save();

    console.log('News updated: id=', id, 'title=', title);

    await notifyUsers(
      'News Updated',
      `The post "${title}" has been updated.`,
      news.role,
      String(news._id)
    );

    res.json({
      _id: news._id,
      title: news.title,
      content: news.content,
      category: news.category,
      image: news.image,
      role: news.role,
      createdBy: news.createdBy,
      createdAt: news.createdAt,
      updatedAt: news.updatedAt,
      likeCount: news.likeCount,
      viewCount: news.viewCount,
      likedBy: news.likedBy,
      viewedBy: news.viewedBy,
    });
  } catch (error: any) {
    console.error('Error updating news:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle archive status
router.post('/:id/toggle-archive', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { newsId } = req.body;
  const user = req.user;
  console.log('Toggle archive request: userId=', user?._id, 'newsId=', newsId);

  if (!newsId) {
    console.log('Missing newsId');
     res.status(400).json({ message: 'News ID is required' });
     return;
  }

  try {
    const preferences = await UserPreferences.findOne({ userId: user?._id });
    let archivedNewsIds = preferences?.archivedNewsIds || [];

    if (archivedNewsIds.includes(newsId)) {
      archivedNewsIds = archivedNewsIds.filter((id) => id !== newsId);
    } else {
      archivedNewsIds.push(newsId);
    }

    if (preferences) {
      preferences.archivedNewsIds = archivedNewsIds;
      await preferences.save();
    } else {
      const newPreferences = new UserPreferences({
        userId: user!._id,
        archivedNewsIds,
      });
      await newPreferences.save();
    }

    console.log('Archive toggled: userId=', user?._id, 'newsId=', newsId, 'archived=', archivedNewsIds.includes(newsId));
    // Return the updated archivedNewsIds and the news item if it exists
    const newsItem = await News.findById(newsId);
    res.json({ archivedNewsIds, newsItem });
  } catch (error: any) {
    console.error('Error toggling archive:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like/unlike news
router.post('/like', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { newsId } = req.body;
  const user = req.user;
  console.log('Like news request: userId=', user?._id, 'newsId=', newsId);

  if (!newsId) {
    console.log('Missing newsId');
    res.status(400).json({ message: 'News ID is required' });
    return;
  }

  try {
    const news = await News.findById(newsId);
    if (!news) {
      console.log('News not found:', newsId);
      res.status(404).json({ message: 'News not found' });
      return;
    }

    const userId = user!._id;
    const isLiked = news.likedBy.includes(userId);
    if (isLiked) {
      news.likedBy = news.likedBy.filter((id) => id !== userId);
      news.likeCount = Math.max(0, news.likeCount - 1);
    } else {
      news.likedBy.push(userId);
      news.likeCount += 1;
    }

    await news.save();
    console.log('Like toggled: newsId=', newsId, 'liked=', !isLiked);
    res.json({
      _id: news._id,
      likeCount: news.likeCount,
      likedBy: news.likedBy,
      viewCount: news.viewCount,
      updatedAt: news.updatedAt,
    });
  } catch (error: any) {
    console.error('Error liking news:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Increment view count
router.post('/:id/view', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) {
     res.status(400).json({ message: 'User ID required' });
     return;
  }
  try {
    const news = await News.findById(id);
    if (!news) {
       res.status(404).json({ message: 'News not found' });
       return;
    }
    if (!news.viewedBy.includes(userId)) {
      news.viewCount += 1;
      news.viewedBy.push(userId);
      await news.save();
    }
    res.json(news);
  } catch (error: any) {
    console.error('View count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;