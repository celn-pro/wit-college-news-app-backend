import express, { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Get all users (admin only)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user;
  console.log('Get users request: userId=', user?._id);

  if (!user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Only admins can view users' });
     return;
  }

  try {
    const users = await User.find().select('username email role isAdmin');
    console.log('Fetched users:', users.length);
    res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  console.log('Get user request: userId=', user?._id, 'targetId=', id);

  if (user?._id !== id && !user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Unauthorized' });
     return;
  }

  try {
    const targetUser = await User.findById(id).select('username email role isAdmin selectedCategories lastLogin');
    if (!targetUser) {
      console.log('User not found:', id);
       res.status(404).json({ message: 'User not found' });
       return;
    }
    res.json(targetUser);
  } catch (error: any) {
    console.error('Error fetching user:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { email, displayName } = req.body;
  const user = req.user;
  console.log('Update user request: userId=', user?._id, 'targetId=', id, 'email=', email);

  if (user?._id !== id && !user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const targetUser = await User.findById(id);
    if (!targetUser) {
      console.log('User not found:', id);
       res.status(404).json({ message: 'User not found' });
       return;
    }

    if (email) {
      const existingEmail = await User.findOne({ email, _id: { $ne: id } });
      if (existingEmail) {
        console.log('Email already exists:', email);
         res.status(400).json({ message: 'Email already exists' });
         return;
      }
      targetUser.email = email;
    }
    if (displayName) targetUser.username = displayName;

    await targetUser.save();
    console.log('User updated: username=', targetUser.username, 'email=', targetUser.email);
    res.json({ username: targetUser.username, email: targetUser.email });
  } catch (error: any) {
    console.error('Error updating user:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role (admin only)
router.patch('/:id/role', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const { role } = req.body;
  console.log('Update role request: userId=', user?._id, 'targetId=', id, 'newRole=', role);

  if (!user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Only admins can update roles' });
     return;
  }

  if (!['student', 'faculty', 'admin'].includes(role)) {
    console.log('Invalid role:', role);
     res.status(400).json({ message: 'Invalid role' });
     return;
  }

  try {
    const targetUser = await User.findById(id);
    if (!targetUser) {
      console.log('User not found:', id);
       res.status(404).json({ message: 'User not found' });
       return;
    }

    targetUser.role = role;
    targetUser.isAdmin = role === 'admin';
    await targetUser.save();
    console.log('Role updated: username=', targetUser.username, 'newRole=', role);
    res.json({ username: targetUser.username, role, isAdmin: targetUser.isAdmin });
  } catch (error: any) {
    console.error('Error updating role:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset user password (admin only)
router.patch('/:id/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  const { password } = req.body;
  console.log('Reset password request: userId=', user?._id, 'targetId=', id);

  if (!user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Only admins can reset passwords' });
     return;
  }

  try {
    const targetUser = await User.findById(id);
    if (!targetUser) {
      console.log('User not found:', id);
       res.status(404).json({ message: 'User not found' });
       return;
    }

    targetUser.password = await bcrypt.hash(password, 10);
    await targetUser.save();
    console.log('Password reset: username=', targetUser.username);
    res.json({ message: 'Password reset' });
  } catch (error: any) {
    console.error('Error resetting password:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user categories
router.patch('/:id/categories', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { selectedCategories } = req.body;
  const user = req.user;
  console.log('Update categories request: userId=', user?._id, 'targetId=', id);

  if (user?._id !== id && !user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Unauthorized' });
     return;
  }

  try {
    const targetUser = await User.findById(id);
    if (!targetUser) {
      console.log('User not found:', id);
       res.status(404).json({ message: 'User not found' });
       return;
    }

    targetUser.selectedCategories = selectedCategories;
    await targetUser.save();
    console.log('Categories updated: username=', targetUser.username);
    res.json({ selectedCategories: targetUser.selectedCategories });
  } catch (error: any) {
    console.error('Error updating categories:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user;
  const { id } = req.params;
  console.log('Delete user request: userId=', user?._id, 'targetId=', id);

  if (!user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Only admins can delete users' });
     return;
  }

  try {
    const targetUser = await User.findById(id);
    if (!targetUser) {
      console.log('User not found:', id);
       res.status(404).json({ message: 'User not found' });
       return;
    }

    await targetUser.deleteOne();
    console.log('User deleted: username=', targetUser.username);
    res.json({ message: 'User deleted' });
  } catch (error: any) {
    console.error('Error deleting user:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;