// tests/setup.js
process.env.TEST_MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27022/test_customer_db';

// Increase timeout for integration tests
jest.setTimeout(30000);