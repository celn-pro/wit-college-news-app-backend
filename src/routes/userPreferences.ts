import express, { Request, Response } from 'express';
import UserPreferences, { IUserPreferences } from '../models/UserPreferences';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get user preferences by userId
router.get('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const user = req.user;
  console.log('Get user preferences request: userId=', user?._id, 'targetUserId=', userId);

  if (user?._id !== userId && !user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Unauthorized' });
     return;
  }

  try {
    const preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      console.log('Preferences not found, returning empty:', userId);
       res.json({ userId, archivedNewsIds: [] });
       return;
    }
    console.log('Fetched preferences: userId=', userId, 'archivedNewsIds=', preferences.archivedNewsIds.length);
    res.json(preferences);
  } catch (error: any) {
    console.error('Error fetching preferences:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user preferences
router.post('/update-categories', authMiddleware, async (req, res) => {
  try {
    const { userId, selectedCategories } = req.body;
    
    if (!userId) {
       res.status(400).json({ message: 'User ID is required' });
       return;
    }
    
    // Find user preferences or create new document if it doesn't exist
    let userPreferences = await UserPreferences.findOne({ userId });
    
    if (!userPreferences) {
      userPreferences = new UserPreferences({
        userId,
        selectedCategories: selectedCategories || [],
        archivedNewsIds: []
      });
    } else {
      userPreferences.selectedCategories = selectedCategories || [];
      userPreferences.updatedAt = Date.now();
    }
    
    await userPreferences.save();
    
    res.status(200).json(userPreferences);
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;