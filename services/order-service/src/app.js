require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const orderRoutes = require('./routes/order');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/orders', orderRoutes);

// Error handling middleware
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to order_db'))
  .catch(err => console.error('Could not connect to order_db...', err));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Order Service listening on port ${PORT}`);
});
