require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const productRoutes = require('./routes/product');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/products', productRoutes);

// Error handling middleware
app.use(errorHandler);

// Database connection (skip if already connected, useful for testing)
if (!mongoose.connection.readyState) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to product_db'))
    .catch(err => console.error('Could not connect to product_db...', err));
}

// Only start the server if this file is being run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`Product Service listening on port ${PORT}`);
  });
}

module.exports = app;
