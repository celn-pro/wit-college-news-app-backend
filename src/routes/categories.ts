import express, { Request, Response } from 'express';
import Category, { ICategory } from '../models/Category';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all categories
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  console.log('Get categories request: userId=', req.user?._id);
  try {
    const categories = await Category.find().select('name');
    res.json(categories);
  } catch (error: any) {
    console.error('Error fetching categories:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add category (admin only)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const user = req.user;
  console.log('Add category request: userId=', user?._id, 'name=', name);

  if (!user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Only admins can add categories' });
     return;
  }

  if (!name || name.length < 3 || name.length > 50) {
    console.log('Invalid category name:', name);
     res.status(400).json({ message: 'Category name must be 3–50 characters' });
     return;
  }

  try {
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      console.log('Category already exists:', name);
       res.status(400).json({ message: 'Category already exists' });
       return;
    }

    const category: ICategory = new Category({
      name,
      createdBy: user._id,
    });

    await category.save();
    console.log('Category created: name=', name);
    res.status(201).json(category);
  } catch (error: any) {
    console.error('Error adding category:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete category (admin only)
router.delete('/:name', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name } = req.params;
  const user = req.user;
  console.log('Delete category request: userId=', user?._id, 'name=', name);

  if (!user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Only admins can delete categories' });
     return;
  }

  try {
    const category = await Category.findOneAndDelete({ name });
    if (!category) {
      console.log('Category not found:', name);
       res.status(404).json({ message: 'Category not found' });
       return;
    }

    console.log('Category deleted: name=', name);
    res.json({ message: 'Category deleted' });
  } catch (error: any) {
    console.error('Error deleting category:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;