const { processPayment } = require('../../src/controllers/paymentController');
const amqp = require('amqplib');

// Mock amqplib
jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

describe('Payment Controller Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockChannel;
  let mockConnection;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock request, response, and next
    mockReq = {
      body: {
        customerId: 'cust123',
        orderId: 'order123',
        productId: 'prod123',
        amount: 100,
        paymentMethod: 'credit_card'
      }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    // Setup mock RabbitMQ channel and connection
    mockChannel = {
      assertQueue: jest.fn().mockResolvedValue({}),
      sendToQueue: jest.fn(),
      close: jest.fn().mockResolvedValue({}),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue({}),
    };

    amqp.connect.mockResolvedValue(mockConnection);
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      await processPayment(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Payment processed and transaction published.',
          transactionId: expect.any(String)
        })
      );

      // Verify RabbitMQ interactions
      expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost');
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('transaction_queue', { durable: true });
      expect(mockChannel.sendToQueue).toHaveBeenCalled();
    });

    it('should handle missing required fields', async () => {
      mockReq.body = { customerId: 'cust123' }; // Missing required fields

      await processPayment(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Missing required payment fields',
          statusCode: 400
        })
      );
      expect(amqp.connect).not.toHaveBeenCalled();
    });

    it('should handle RabbitMQ connection error', async () => {
      const error = new Error('Connection failed');
      amqp.connect.mockRejectedValue(error);

      await processPayment(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Payment processing failed or queue connection error',
          statusCode: 500
        })
      );
    });

    it('should handle channel creation error', async () => {
      mockConnection.createChannel.mockRejectedValue(new Error('Channel creation failed'));

      await processPayment(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Payment processing failed or queue connection error',
          statusCode: 500
        })
      );
    });
  });
});