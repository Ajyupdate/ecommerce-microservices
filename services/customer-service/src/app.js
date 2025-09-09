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

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to customer_db'))
  .catch(err => console.error('Could not connect to customer_db...', err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Customer Service listening on port ${PORT}`);
});
