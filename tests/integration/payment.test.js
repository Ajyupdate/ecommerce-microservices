const request = require('supertest');
const app = require('../../src/app');
const amqp = require('amqplib');

jest.mock('amqplib'); // Mock amqplib for integration tests

describe('Payment Service Integration Tests', () => {
  let mockChannel, mockConnection;

  beforeAll(async () => {
    mockChannel = {
      sendToQueue: jest.fn(),
      close: jest.fn(),
    };
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn(),
    };
    amqp.connect.mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/payments should process payment and publish to queue', async () => {
    const paymentData = {
      customerId: 'CUST001',
      orderId: 'ORD001',
      productId: 'PROD001',
      amount: 100.00,
      paymentMethod: 'credit_card',
    };

    const response = await request(app)
      .post('/api/payments')
      .send(paymentData)
      .expect(200);

    expect(response.body.message).toBe('Payment processed successfully');
    expect(response.body).toHaveProperty('transactionId');
    expect(mockChannel.sendToQueue).toHaveBeenCalledTimes(1);
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      'transaction_queue',
      expect.any(Buffer)
    );
  });

  test('POST /api/payments should handle errors during publishing', async () => {
    const paymentData = {
      customerId: 'CUST001',
      orderId: 'ORD001',
      productId: 'PROD001',
      amount: 100.00,
      paymentMethod: 'credit_card',
    };

    mockChannel.sendToQueue.mockRejectedValueOnce(new Error('RabbitMQ error'));

    const response = await request(app)
      .post('/api/payments')
      .send(paymentData)
      .expect(500); // Expect a 500 status due to the error handler

    expect(response.body.message).toBe('RabbitMQ error');
    expect(mockChannel.sendToQueue).toHaveBeenCalledTimes(1);
  });
});
