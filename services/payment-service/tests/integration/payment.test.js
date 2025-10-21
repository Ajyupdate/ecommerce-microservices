const request = require('supertest');
const amqp = require('amqplib');
const app = require('../../src/app');

// Mock amqplib
jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

describe('Payment Service Integration Tests', () => {
  let mockChannel;
  let mockConnection;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

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

  describe('POST /api/payments', () => {
    it('should process payment and publish transaction successfully', async () => {
      const paymentData = {
        customerId: 'cust123',
        orderId: 'order123',
        productId: 'prod123',
        amount: 100,
        paymentMethod: 'credit_card'
      };

      const response = await request(app)
        .post('/api/payments')
        .send(paymentData)
        .expect(200);

      // Check response structure
      expect(response.body).toHaveProperty('message', 'Payment processed and transaction published.');
      expect(response.body).toHaveProperty('transactionId');

      // Verify RabbitMQ interactions
      expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost');
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('transaction_queue', { durable: true });
      expect(mockChannel.sendToQueue).toHaveBeenCalled();
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();

      // Verify the message sent to queue
      const sentMessage = JSON.parse(mockChannel.sendToQueue.mock.calls[0][1]);
      expect(sentMessage).toMatchObject({
        ...paymentData,
        paymentStatus: 'completed'
      });
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        customerId: 'cust123',
        // Missing orderId and other required fields
      };

      const response = await request(app)
        .post('/api/payments')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(amqp.connect).not.toHaveBeenCalled();
    });

    it('should return 500 when RabbitMQ connection fails', async () => {
      const paymentData = {
        customerId: 'cust123',
        orderId: 'order123',
        productId: 'prod123',
        amount: 100,
        paymentMethod: 'credit_card'
      };

      // Simulate RabbitMQ connection failure
      amqp.connect.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app)
        .post('/api/payments')
        .send(paymentData)
        .expect(500);

      expect(response.body).toHaveProperty('message');
      expect(amqp.connect).toHaveBeenCalledWith('amqp://localhost');
    });
  });
});