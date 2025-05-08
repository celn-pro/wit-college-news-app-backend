import mongoose from 'mongoose';
import News from './models/News';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/collegenews';

const sampleNews = [
  {
    title: 'Annual Tech Symposium 2025',
    content: 'Join us for the Annual Tech Symposium on May 15, 2025, at DIT Main Campus. Featuring guest speakers, workshops, and project showcases.',
    category: 'Events',
    role: 'all',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=60',
    createdAt: new Date('2025-04-20T10:00:00Z'),
  },
  {
    title: 'Semester Exam Registration Deadline',
    content: 'Reminder: The deadline to register for semester exams is April 30, 2025. Visit the academic office for more details.',
    category: 'Deadlines',
    role: 'student',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&auto=format&fit=crop&q=60',
    createdAt: new Date('2025-04-22T08:00:00Z'),
  },
  {
    title: 'New Computer Lab Opening',
    content: 'We are excited to announce the opening of a new state-of-the-art computer lab in Building C, starting May 1, 2025.',
    category: 'Announcements',
    role: 'all',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60',
    createdAt: new Date('2025-04-25T09:00:00Z'),
  },
  {
    title: 'DIT Student Wins National Coding Competition',
    content: 'Congratulations to Jane Doe from OD22COE for winning the National Coding Competition 2025!',
    category: 'Achievements',
    role: 'all',
    image: 'https://images.unsplash.com/photo-1593642634315-48f5414c3ad9?w=800&auto=format&fit=crop&q=60',
    createdAt: new Date('2025-04-26T12:00:00Z'),
  },
  {
    title: 'Guest Lecture on AI and Ethics',
    content: 'Join us for a guest lecture on AI and Ethics by Dr. John Smith on May 10, 2025, at 2:00 PM in the Main Auditorium.',
    category: 'Events',
    role: 'all',
    image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d466b0?w=800&auto=format&fit=crop&q=60',
    createdAt: new Date('2025-04-27T07:00:00Z'),
  },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await News.deleteMany({});
    console.log('Cleared existing news data');

    // Insert sample data
    await News.insertMany(sampleNews);
    console.log('Inserted sample news data');

    mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error seeding database:', error);
    mongoose.connection.close();
  }
};

seedDatabase();