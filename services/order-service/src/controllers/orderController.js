const Order = require('../models/order');
const axios = require('axios');

const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';


exports.createOrder = async (req, res, next) => {
  try {
    const { customerId, productId, quantity, amount } = req.body;
    console.log(customerId, productId, quantity, amount, "line 1ff2")
    // 1. Validate request data (basic validation)
    if (!customerId || !productId || !quantity || !amount) {
      const error = new Error('Missing required order fieldssss');
      error.statusCode = 400;
      throw error;
    }

    // 2. Call Customer Service to validate customer exists
    const customerResponse = await axios.get(`${CUSTOMER_SERVICE_URL}/api/customers/${customerId}`);
    if (customerResponse.status !== 200) {
      const error = new Error('Customer not found');
      error.statusCode = 404;
      throw error;
    }

    // 3. Call Product Service to validate product and check stock
    const productResponse = await axios.get(`${PRODUCT_SERVICE_URL}/api/products/${productId}`);
    if (productResponse.status !== 200) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }
    const product = productResponse.data;

    if (product.stock < quantity) {
      const error = new Error('Insufficient product stock');
      error.statusCode = 400;
      throw error;
    }

    
    // I assume stock is updated after successful payment for simplicity

    // 4. Create order with status 'pending'
    const newOrder = new Order({
      orderId: `ORD-${Date.now()}`,
      customerId,
      productId,
      quantity,
      amount,
      orderStatus: 'pending',
    });
    await newOrder.save();

    // 5. Call Payment Service with order details
    // This will be handled asynchronously by the Payment Service publishing to RabbitMQ
    axios.post(`${PAYMENT_SERVICE_URL}/api/payments`, {
      customerId: newOrder.customerId,
      orderId: newOrder.orderId,
      productId: newOrder.productId,
      amount: newOrder.amount,
      paymentMethod: 'credit_card', // Default for demo
    }).catch(err => console.error('Payment service call failed:', err.message));

    // 6. Return order response to customer
    // Update orderStatus to 'successful' since the order is now successful
    console.log("successs 1")
    newOrder.orderStatus = 'completed';
    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    next(error);
  }
};


exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};


exports.getOrdersByCustomerId = async (req, res, next) => {
  try {
    const orders = await Order.find({ customerId: req.params.customerId });
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};
