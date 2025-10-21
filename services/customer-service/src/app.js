require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const customerRoutes = require('./routes/customer');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/customers', customerRoutes);

// Error handling middleware
app.use(errorHandler);

// Database connection - only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to customer_db'))
    .catch(err => console.error('Could not connect to customer_db...', err));
}

module.exports = app;
