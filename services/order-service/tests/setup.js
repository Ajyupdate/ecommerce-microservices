// tests/setup.js
process.env.TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27024/test_order_db';
process.env.CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3001';
process.env.PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
process.env.PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004';

// Increase timeout for integration tests
jest.setTimeout(30000);