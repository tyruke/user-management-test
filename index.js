// File: user-management-system/index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const userRoutes = require('./routes/users');
const { connectToDatabase } = require('./config/database');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Serve HTML files from the 'views' directory
app.use('/views', express.static(path.join(__dirname, 'views')));

// API Routes
app.use('/api/users', userRoutes);

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// Database connection
connectToDatabase();

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});