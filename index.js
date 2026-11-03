const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { connectDB, getCollection, formatId } = require('./db');
const { verifyToken, JWT_SECRET } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Root health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    name: 'BookNook Library API',
    version: '1.0.0',
    description: 'REST API backend for BookNook - A Small Online Library',
    endpoints: [
      'GET /books',
      'GET /books/:id',
      'POST /books (protected)',
      'PATCH /books/:id (protected)',
      'DELETE /books/:id (protected)',
      'POST /borrows (protected)',
      'GET /borrows (protected)',
      'DELETE /borrows/:id (protected)',
      'POST /auth/register',
      'POST /auth/login',
      'POST /auth/google',
      'GET /auth/me (protected)'
    ]
  });
});

/* ==========================================================================
   AUTHENTICATION ROUTES
   ========================================================================== */

// POST /auth/register
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, photoUrl, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required fields.'
      });
    }

    // Password Validation Requirements:
    // 1. Must have an Uppercase letter
    // 2. Must have a Lowercase letter
    // 3. Length must be at least 6 characters
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter (A-Z).'
      });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one lowercase letter (a-z).'
      });
    }

    const usersCol = getCollection('users');
    const existing = await usersCol.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      photoUrl: photoUrl?.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      password: hashedPassword,
      createdAt: new Date()
    };

    const result = await usersCol.insertOne(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! You can now log in.',
      userId: result.insertedId
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.'
    });
  }
});

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const usersCol = getCollection('users');
    const user = await usersCol.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: user._id.toString ? user._id.toString() : user._id,
      email: user.email,
      name: user.name,
      photoUrl: user.photoUrl
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Login successful! Welcome back to BookNook.',
      token,
      user: tokenPayload
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login.'
    });
  }
});

// POST /auth/google - Social login
app.post('/auth/google', async (req, res) => {
  try {
    const { email, name, photoUrl } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Google email is required.'
      });
    }

    const usersCol = getCollection('users');
    let user = await usersCol.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      user = {
        name: name || email.split('@')[0],
        email: email.toLowerCase().trim(),
        photoUrl: photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || email)}`,
        authProvider: 'google',
        createdAt: new Date()
      };
      const result = await usersCol.insertOne(user);
      user._id = result.insertedId;
    }

    const tokenPayload = {
      id: user._id.toString ? user._id.toString() : user._id,
      email: user.email,
      name: user.name,
      photoUrl: user.photoUrl
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Signed in with Google successfully!',
      token,
      user: tokenPayload
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during Google sign in.'
    });
  }
});

// GET /auth/me - Protected user verification
app.get('/auth/me', verifyToken, async (req, res) => {
  try {
    return res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user session.'
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.'
  });
});

// Start server
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` BookNook Server running on http://localhost:${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`===============================================`);
  });
}

startServer();
