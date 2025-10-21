const amqp = require('amqplib');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Transaction = require('../../src/models/transaction');
const { startWorker, shutdown } = require('../../src/worker');

// Mock amqplib
jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

describe('Queue Worker Integration Tests', () => {
  let mongoServer;
  let mockChannel;
  let mockConnection;
  let mockMsg;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';

    // Create in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Set environment variables for different databases
    process.env.MONGODB_URI = mongoUri;
    process.env.MONGODB_URI_PRODUCT = mongoUri;
    process.env.MONGODB_URI_ORDER = mongoUri;

    // Connect to MongoDB and set up models
    await mongoose.connect(mongoUri);
    
    // Create models
    const Product = mongoose.model('Product', require('../../src/models/product').schema);
    const Order = mongoose.model('Order', require('../../src/models/order').schema);

    // Set globally
    global.Product = Product;
    global.Order = Order;

    // Mock RabbitMQ channel and connection
    mockChannel = {
      assertQueue: jest.fn().mockResolvedValue({}),
      prefetch: jest.fn().mockResolvedValue({}),
      consume: jest.fn(),
      ack: jest.fn(),
      reject: jest.fn(),
      publish: jest.fn(),
      close: jest.fn().mockResolvedValue({}),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue({}),
    };

    amqp.connect.mockResolvedValue(mockConnection);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Disconnect and reconnect to ensure a clean state
    await mongoose.disconnect();
    await mongoose.connect(mongoServer.getUri());

    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }

    // Reset all mocks
    jest.clearAllMocks();

    // Create test order and product data
    const Order = global.Order;
    const Product = global.Product;

    await Order.create({
      orderId: 'test-order-1',
      customerId: 'test-cust-1',
      productId: 'test-prod-1',
      orderStatus: 'pending',
      amount: 99.99,
      quantity: 1
    });

    await Product.create({
      productId: 'test-prod-1',
      name: 'Test Product',
      description: 'A test product for integration testing',
      price: 99.99,
      stock: 10
    });

    // Create a mock message
    mockMsg = {
      content: Buffer.from(JSON.stringify({
        transactionId: 'test-trans-1',
        orderId: 'test-order-1',
        customerId: 'test-cust-1',
        productId: 'test-prod-1',
        amount: 99.99,
        paymentMethod: 'credit_card',
        paymentStatus: 'completed'
      })),
      properties: {
        headers: {}
      }
    };
  });

  describe('Message Processing', () => {
    it('should process transaction message successfully', async () => {
      // Set up channel.consume mock implementation
      mockChannel.consume.mockImplementation((queue, callback) => {
        callback(mockMsg);
      });

      // Start the worker
      await startWorker();

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify transaction was saved
      const savedTransaction = await Transaction.findOne({ transactionId: 'test-trans-1' });
      expect(savedTransaction).toBeTruthy();
      expect(savedTransaction.orderId).toBe('test-order-1');
      expect(savedTransaction.paymentStatus).toBe('completed');

      // Verify RabbitMQ interactions
      expect(mockChannel.assertQueue).toHaveBeenCalled();
      expect(mockChannel.prefetch).toHaveBeenCalledWith(1);
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    });

    it('should handle database errors and retry', async () => {
      // Force a database error by making Transaction.save throw
      const saveSpy = jest.spyOn(mongoose.Model.prototype, 'save');
      saveSpy.mockRejectedValueOnce(new Error('Database error'));

      // Set up channel.consume mock implementation
      mockChannel.consume.mockImplementation((queue, callback) => {
        callback(mockMsg);
      });

      // Start the worker
      await startWorker();

      // Wait for retry delay
      await new Promise(resolve => setTimeout(resolve, 5100));

      // Verify retry behavior
      expect(mockChannel.publish).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);

      // Clean up
      saveSpy.mockRestore();
    });

    it('should handle max retries and reject message', async () => {
      // Set message with max retries
      const msgWithMaxRetries = {
        ...mockMsg,
        properties: {
          headers: {
            'x-death': [{
              count: 5
            }]
          }
        }
      };

      // Force a database error
      const saveSpy = jest.spyOn(mongoose.Model.prototype, 'save');
      saveSpy.mockRejectedValue(new Error('Persistent database error'));

      // Set up channel.consume mock implementation
      mockChannel.consume.mockImplementation((queue, callback) => {
        callback(msgWithMaxRetries);
      });

      // Start the worker
      await startWorker();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify message was rejected
      expect(mockChannel.reject).toHaveBeenCalledWith(msgWithMaxRetries, false);

      // Clean up
      saveSpy.mockRestore();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close connections on shutdown', async () => {
      // Start the worker
      await startWorker();

      // Trigger shutdown
      await shutdown('SIGTERM');

      // Verify connections were closed
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      
      // Verify MongoDB was disconnected
      expect(mongoose.connection.readyState).toBe(0);
    });
  });
});