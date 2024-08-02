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
app.use(express.static(path.join(__dirname, 'views')));

// API Routes
app.use('/api/users', userRoutes);

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Database connection
connectToDatabase()
  .then(() => {
    console.log('Connected to database successfully');
    // Start the server
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to the database:', error);
  });