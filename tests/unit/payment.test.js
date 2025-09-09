const paymentController = require('../../src/controllers/paymentController');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

jest.mock('amqplib');
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('Payment Controller Unit Tests', () => {
  let mockReq, mockRes, mockNext;
  let mockChannel;

  beforeEach(() => {
    mockReq = {
      body: {
        customerId: 'CUST001',
        orderId: 'ORD001',
        productId: 'PROD001',
        amount: 100.00,
        paymentMethod: 'credit_card',
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();

    mockChannel = {
      sendToQueue: jest.fn(),
    };

    mockReq.channel = mockChannel; // Attach mocked channel to request

    uuidv4.mockReturnValue('MOCK_UUID');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPayment', () => {
    test('should process payment successfully and send to queue', async () => {
      await paymentController.processPayment(mockReq, mockRes, mockNext);

      expect(uuidv4).toHaveBeenCalledTimes(1);
      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'transaction_queue',
        Buffer.from(JSON.stringify({
          transactionId: 'MOCK_UUID',
          customerId: 'CUST001',
          orderId: 'ORD001',
          productId: 'PROD001',
          amount: 100.00,
          paymentMethod: 'credit_card',
          timestamp: expect.any(String),
          status: 'completed'
        }))
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Payment processed successfully', transactionId: 'MOCK_UUID' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if an exception occurs', async () => {
      const error = new Error('Publish error');
      mockChannel.sendToQueue.mockRejectedValueOnce(error);

      await paymentController.processPayment(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });
});
