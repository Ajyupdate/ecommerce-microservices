const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: [true, 'Transaction ID is required'],
    unique: true,
  },
  orderId: {
    type: String,
    required: [true, 'Order ID is required'],
  },
  customerId: {
    type: String,
    required: [true, 'Customer ID is required'],
  },
  productId: {
    type: String,
    required: [true, 'Product ID is required'],
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive'],
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: {
      values: ['credit_card', 'debit_card', 'bank_transfer'],
      message: '{VALUE} is not a supported payment method'
    }
  },
  paymentStatus: {
    type: String,
    required: [true, 'Payment status is required'],
    enum: {
      values: ['pending', 'completed', 'failed'],
      message: '{VALUE} is not a valid payment status'
    },
    default: 'pending'
  },
  timestamp: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
