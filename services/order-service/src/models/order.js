const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  customerId: {
    type: String,
    required: true,
  },
  productId: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  amount: {
    type: Number,
    required: true,
  },
  orderStatus: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'cancelled', 'failed'],
    default: 'pending',
  },
  transactionId: {
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
