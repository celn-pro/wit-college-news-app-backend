import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import FacultyCode from '../models/FacultyCode';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Secret key for JWT (store in .env for production)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Signup route
router.post('/signup', async (req: Request, res: Response) => {
  const { username, password, email, role, facultyCode } = req.body;
  console.log('Signup request: username=', username, 'email=', email, 'role=', role, 'facultyCode=', facultyCode ? 'provided' : 'not provided');

  if (!username || !password || !email) {
    console.log('Missing required fields: username=', username, 'password=', !!password, 'email=', email);
     res.status(400).json({ message: 'Username, password, and email are required' });
     return;
  }

  if (username.length < 3 || username.length > 20) {
    console.log('Invalid username length:', username.length);
     res.status(400).json({ message: 'Username must be 3–20 characters' });
     return;
  }

  if (password.length < 6) {
    console.log('Password too short:', password.length);
     res.status(400).json({ message: 'Password must be at least 6 characters' });
     return;
  }

  if (!['student', 'faculty'].includes(role)) {
    console.log('Invalid role:', role);
     res.status(400).json({ message: 'Role must be student or faculty' });
     return;
  }

  if (role === 'faculty') {
    if (!facultyCode) {
      console.log('Missing faculty code for faculty role');
       res.status(400).json({ message: 'Faculty code is required' });
       return;
    }

    const code = await FacultyCode.findOne({ code: facultyCode, email, used: false });
    if (!code || code.expiresAt < new Date()) {
      console.log('Invalid or expired faculty code:', facultyCode);
       res.status(400).json({ message: 'Invalid or expired faculty code' });
       return;
    }
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      console.log('Signup failed: Username or email already exists:', username, email);
       res.status(400).json({ message: 'Username or email already exists' });
       return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user: IUser = new User({
      username,
      password: hashedPassword,
      email,
      role,
      isAdmin: false,
    });

    await user.save();
    console.log('User created: username=', username, 'role=', user.role);

    // Mark faculty code as used
    if (role === 'faculty' && facultyCode) {
      await FacultyCode.updateOne({ code: facultyCode, email }, { used: true });
    }

    // Generate JWT token
    const token = jwt.sign(
      { _id: user._id, username: user.username, email: user.email, role: user.role, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({ token, user: { _id: user._id, username: user.username, email: user.email, role: user.role, isAdmin: user.isAdmin, lastLogin: user.lastLogin } });
  } catch (error: any) {
    console.error('Signup error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login route
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  console.log('Login request: username=', username);

  try {
    // Find user
    const user = await User.findOne({ username }) as IUser & { _id: string };
    if (!user) {
      console.log('Login failed: User not found:', username);
       res.status(401).json({ message: 'Invalid credentials' });
       return;
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Login failed: Invalid password for user:', username);
       res.status(401).json({ message: 'Invalid credentials' });
       return;
    }

    // Update lastLogin
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { _id: user._id.toString(), username: user.username, email: user.email, role: user.role, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    console.log('Login successful: username=', username, 'role=', user.role);

    res.json({ token, user: { _id: user._id, username: user.username, email: user.email, role: user.role, isAdmin: user.isAdmin, lastLogin: user.lastLogin } });
  } catch (error: any) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin-only: Create admin user
router.post('/make-admin', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user;
  const { username, password, email } = req.body;
  console.log('Make admin request: requester userId=', user?._id, 'target username=', username);

  if (!user?.isAdmin) {
    console.log('Unauthorized: Non-admin user:', user?._id);
     res.status(403).json({ message: 'Only admins can create admins' });
     return;
  }

  if (!username || !password || !email) {
    console.log('Missing required fields: username=', username, 'password=', !!password, 'email=', email);
     res.status(400).json({ message: 'Username, password, and email are required' });
     return;
  }

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      console.log('Admin creation failed: Username or email already exists:', username, email);
       res.status(400).json({ message: 'Username or email already exists' });
       return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser: IUser = new User({
      username,
      password: hashedPassword,
      email,
      role: 'admin',
      isAdmin: true,
    });

    await newUser.save();
    console.log('Admin created: username=', username);

    res.status(201).json({ user: { username: newUser.username, email: newUser.email, role: newUser.role, isAdmin: newUser.isAdmin } });
  } catch (error: any) {
    console.error('Admin creation error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

// One-time endpoint to create first admin (remove after use)
router.post('/init-admin', async (req: Request, res: Response) => {
  const { username, password, email } = req.body;
  console.log('Init admin request: username=', username);

  const adminExists = await User.findOne({ isAdmin: true });
  if (adminExists) {
    console.log('Init admin failed: Admin already exists');
     res.status(403).json({ message: 'Admin already exists' });
     return;
  }

  if (!username || !password || !email) {
    console.log('Missing required fields: username=', username, 'password=', !!password, 'email=', email);
     res.status(400).json({ message: 'Username, password, and email are required' });
     return;
  }

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      console.log('Init admin failed: Username or email already exists:', username, email);
       res.status(400).json({ message: 'Username or email already exists' });
       return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user: IUser = new User({
      username,
      password: hashedPassword,
      email,
      role: 'admin',
      isAdmin: true,
    });

    await user.save();
    console.log('Initial admin created: username=', username);

    res.status(201).json({ user: { username: user.username, email: user.email, role: user.role, isAdmin: user.isAdmin } });
  } catch (error: any) {
    console.error('Init admin error:', error.message, error.stack);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;