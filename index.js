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

/* ==========================================================================
   BOOK ROUTES (8 Required APIs)
   ========================================================================== */

// 1. GET /books — get all books (public)
// Supports query params: ?limit=6&sort=newest (for New Arrivals), ?category=..., ?search=..., ?userEmail=...
app.get('/books', async (req, res) => {
  try {
    const { limit, sort, category, search, userEmail } = req.query;
    const booksCol = getCollection('books');

    const filter = {};
    if (category && category !== 'All') {
      filter.category = category;
    }
    if (userEmail) {
      filter.userEmail = userEmail;
    }

    let cursor = booksCol.find(filter);

    // Sorting: Newest first is default when sort=newest or by createdAt descending
    const sortObj = (sort === 'newest' || !sort) ? { createdAt: -1 } : { createdAt: 1 };
    cursor = cursor.sort(sortObj);

    if (limit) {
      cursor = cursor.limit(parseInt(limit, 10));
    }

    let books = await cursor.toArray();

    // Client-side text filter if search parameter was provided
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      books = books.filter(b => 
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.author && b.author.toLowerCase().includes(q)) ||
        (b.category && b.category.toLowerCase().includes(q))
      );
    }

    return res.json({
      success: true,
      count: books.length,
      data: books
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve books from database.'
    });
  }
});

// 2. GET /books/:id — get one book
app.get('/books/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const booksCol = getCollection('books');
    const book = await booksCol.findOne({ _id: formatId(id) });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found.'
      });
    }

    return res.json({
      success: true,
      data: book
    });
  } catch (error) {
    console.error('Error fetching book details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve book details.'
    });
  }
});

// 3. POST /books — add a book (protected with JWT)
app.post('/books', verifyToken, async (req, res) => {
  try {
    const { title, author, category, image, description, copies } = req.body;

    if (!title || !author || !category || !image || !description) {
      return res.status(400).json({
        success: false,
        message: 'All fields (title, author, category, image, description) are required.'
      });
    }

    const totalCopies = parseInt(copies, 10);
    if (isNaN(totalCopies) || totalCopies < 1) {
      return res.status(400).json({
        success: false,
        message: 'Total copies must be a valid number of at least 1.'
      });
    }

    const newBook = {
      title: title.trim(),
      author: author.trim(),
      category: category.trim(),
      image: image.trim(),
      description: description.trim(),
      copies: totalCopies,
      userEmail: req.user.email,
      userName: req.user.name,
      createdAt: new Date()
    };

    const booksCol = getCollection('books');
    const result = await booksCol.insertOne(newBook);

    return res.status(201).json({
      success: true,
      message: 'Book added successfully to the library!',
      data: {
        ...newBook,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error('Error adding book:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save book to database.'
    });
  }
});

// 4. PATCH /books/:id — update a book (protected with JWT)
app.patch('/books/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const { title, author, category, image, description, copies } = req.body;
    const booksCol = getCollection('books');

    const existing = await booksCol.findOne({ _id: formatId(id) });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Book not found to update.'
      });
    }

    // Security check: Only the user who added it can update it
    if (existing.userEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only edit books that you added.'
      });
    }

    const updateFields = {};
    if (title !== undefined) updateFields.title = title.trim();
    if (author !== undefined) updateFields.author = author.trim();
    if (category !== undefined) updateFields.category = category.trim();
    if (image !== undefined) updateFields.image = image.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (copies !== undefined) {
      const numCopies = parseInt(copies, 10);
      if (!isNaN(numCopies) && numCopies >= 0) {
        updateFields.copies = numCopies;
      }
    }
    updateFields.updatedAt = new Date();

    await booksCol.updateOne(
      { _id: formatId(id) },
      { $set: updateFields }
    );

    const updated = await booksCol.findOne({ _id: formatId(id) });

    return res.json({
      success: true,
      message: 'Book details updated successfully!',
      data: updated
    });
  } catch (error) {
    console.error('Error updating book:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update book.'
    });
  }
});

// 5. DELETE /books/:id — delete a book (protected with JWT)
app.delete('/books/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const booksCol = getCollection('books');

    const existing = await booksCol.findOne({ _id: formatId(id) });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Book not found to delete.'
      });
    }

    // Security check: User can delete only their own books
    if (existing.userEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only delete books that you added.'
      });
    }

    await booksCol.deleteOne({ _id: formatId(id) });

    return res.json({
      success: true,
      message: 'Book deleted successfully from library.'
    });
  } catch (error) {
    console.error('Error deleting book:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete book.'
    });
  }
});

/* ==========================================================================
   BORROW SYSTEM ROUTES
   ========================================================================== */

// 6. POST /borrows — borrow a book (protected with JWT)
// Challenge Requirements:
// 1. Available Copies: Decrease copies by 1 with $inc. If copies are 0, reject with error.
// 2. No Double Borrow: User cannot borrow the same book twice simultaneously.
app.post('/borrows', verifyToken, async (req, res) => {
  try {
    const { bookId, returnDate } = req.body;
    const userEmail = req.user.email;
    const userName = req.user.name;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: 'Book ID is required to borrow.'
      });
    }

    const booksCol = getCollection('books');
    const borrowsCol = getCollection('borrows');

    const book = await booksCol.findOne({ _id: formatId(bookId) });
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'The requested book was not found.'
      });
    }

    // Challenge 1: Check available copies
    if (!book.copies || book.copies <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This book is currently out of stock / Not Available to borrow.'
      });
    }

    // Challenge 2: No Double Borrow check
    // Query borrows for matching bookId and userEmail
    const existingBorrow = await borrowsCol.findOne({
      bookId: book._id.toString ? book._id.toString() : book._id,
      userEmail: userEmail
    });

    if (existingBorrow) {
      return res.status(400).json({
        success: false,
        message: 'You have already borrowed this book! Please return your current copy before borrowing again.'
      });
    }

    // Calculate default return date if not specified (e.g., 7 days from now)
    const dueDate = returnDate ? new Date(returnDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Save borrow record
    const borrowRecord = {
      bookId: book._id.toString ? book._id.toString() : book._id,
      bookTitle: book.title,
      bookImage: book.image,
      userEmail: userEmail,
      userName: userName,
      borrowDate: new Date(),
      returnDate: dueDate,
      createdAt: new Date()
    };

    const result = await borrowsCol.insertOne(borrowRecord);

    // Decrease available copies by 1 using $inc
    await booksCol.updateOne(
      { _id: formatId(book._id) },
      { $inc: { copies: -1 } }
    );

    return res.status(201).json({
      success: true,
      message: `Successfully borrowed "${book.title}"! Due date: ${dueDate.toLocaleDateString()}.`,
      data: {
        ...borrowRecord,
        _id: result.insertedId
      }
    });
  } catch (error) {
    console.error('Error borrowing book:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process book borrow.'
    });
  }
});

// 7. GET /borrows — get the borrows of the logged in user (protected with JWT)
app.get('/borrows', verifyToken, async (req, res) => {
  try {
    const borrowsCol = getCollection('borrows');
    const userEmail = req.user.email;

    const userBorrows = await borrowsCol.find({ userEmail }).sort({ createdAt: -1 }).toArray();

    return res.json({
      success: true,
      count: userBorrows.length,
      data: userBorrows
    });
  } catch (error) {
    console.error('Error fetching borrows:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve borrowed books.'
    });
  }
});

// 8. DELETE /borrows/:id — return a book (protected with JWT)
// When returned, increase book copies by 1 with $inc
app.delete('/borrows/:id', verifyToken, async (req, res) => {
  try {
    const borrowId = req.params.id;
    const borrowsCol = getCollection('borrows');
    const booksCol = getCollection('books');

    const borrow = await borrowsCol.findOne({ _id: formatId(borrowId) });
    if (!borrow) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found.'
      });
    }

    // Verify that the borrow record belongs to this user
    if (borrow.userEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You can only return your own borrowed books.'
      });
    }

    // Increase book copies by 1 using $inc
    if (borrow.bookId) {
      await booksCol.updateOne(
        { _id: formatId(borrow.bookId) },
        { $inc: { copies: 1 } }
      );
    }

    // Remove borrow record
    await borrowsCol.deleteOne({ _id: formatId(borrowId) });

    return res.json({
      success: true,
      message: `"${borrow.bookTitle}" has been returned successfully! Thank you for reading.`
    });
  } catch (error) {
    console.error('Error returning book:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process book return.'
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
