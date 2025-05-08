import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import FacultyCode from '../models/FacultyCode';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Email transporter with explicit credential handling
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  debug: true, // Enable debug output
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP server connection error:', error);
  } else {
    console.log('SMTP server connection successful');
  }
});

// Request faculty code
router.post('/request', async (req: Request, res: Response) => {
  const { email } = req.body;
  console.log('Faculty code request: email=', email);
  
  if (!email || !email.includes('@')) {
    console.log('Invalid email:', email);
     res.status(400).json({ message: 'Valid email is required' });
     return;
  }
  
  // Check if SMTP credentials are set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Email credentials not configured');
     res.status(500).json({ 
      message: 'Email service not configured properly. Please contact the administrator.' 
    });
    return;
  }
  
  try {
    // Generate unique code
    const code = crypto.randomBytes(8).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Store code
    const facultyCode = new FacultyCode({
      code,
      email,
      used: false,
      expiresAt,
    });
    await facultyCode.save();
    console.log('Faculty code generated: code=', code, 'email=', email);
    
    // Send email with detailed options
    const mailOptions = {
      from: `"College News App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Faculty Signup Code',
      text: `Your faculty signup code is: ${code}\n\nUse this code to sign up as a faculty member. It expires in 24 hours.`,
      html: `<h2>Your Faculty Signup Code</h2><p>Your faculty signup code is: <strong>${code}</strong></p><p>Use this code to sign up as a faculty member. It expires in 24 hours.</p>`,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    
    res.status(200).json({ message: 'Faculty code sent to your email' });
  } catch (error: any) {
    console.error('Faculty code request error:', error.message);
    res.status(500).json({ 
      message: 'Failed to send faculty code. Please try again later.' 
    });
  }
});

export default router;