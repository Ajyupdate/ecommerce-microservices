require('dotenv').config();
const express = require('express');
// Although payment service doesn't directly use a model, mongoose might be needed for shared connection logic or future expansion.
const paymentRoutes = require('./routes/payment');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/payments', paymentRoutes);

// Error handling middleware
app.use(errorHandler);

// The payment service does not have its own database, but connects to RabbitMQ.

console.log('Payment Service started. Not connecting to a dedicated database, as it only publishes to RabbitMQ.');

const PORT = process.env.PORT || 3004;
// Only start the server if this file is being run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Payment Service listening on port ${PORT}`);
  });
}

module.exports = app;
