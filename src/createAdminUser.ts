import mongoose from 'mongoose';
// import bcrypt from 'bcryptjs';
import * as bcrypt from 'bcryptjs';
import User, { IUser } from '../src/models/User';
// import dotenv from 'dotenv';
import * as dotenv from 'dotenv';


dotenv.config();

const MONGODB_URI:any = process.env.MONGODB_URI;

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingUser = await User.findOne({ username: 'admin' });
    if (existingUser) {
      console.log('Admin user already exists');
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10); // Default password: admin123

    // Create admin user
    const adminUser: IUser = new User({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      isAdmin: true,
    });

    await adminUser.save();
    console.log('Admin user created successfully');

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error creating admin user:', error);
    await mongoose.disconnect();
  }
};

createAdminUser();