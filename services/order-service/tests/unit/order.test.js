const orderController = require('../../src/controllers/orderController');
const Order = require('../../src/models/order');
const axios = require('axios');

// Mock the Order model and axios
jest.mock('../../src/models/order');
jest.mock('axios');

describe('Order Controller Unit Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    test('should create a new order successfully', async () => {
      const orderData = {
        customerId: 'CUST001',
        productId: 'PROD001',
        quantity: 2,
        amount: 200
      };
      mockReq.body = orderData;

      // Mock successful responses from external services
      axios.get.mockImplementation((url) => {
        if (url.includes('/customers/')) {
          return Promise.resolve({ status: 200, data: { customerId: 'CUST001' } });
        } else if (url.includes('/products/')) {
          return Promise.resolve({ status: 200, data: { stock: 10 } });
        }
        return Promise.reject(new Error('Invalid URL'));
      });

      axios.post.mockResolvedValue({ status: 200 });

      // Mock order creation and save
      const mockOrder = {
        ...orderData,
        orderId: 'ORD-123',
        orderStatus: 'pending',
        save: jest.fn().mockResolvedValue({ 
          ...orderData,
          orderId: 'ORD-123',
          orderStatus: 'completed'
        })
      };

      Order.mockImplementation(() => mockOrder);

      await orderController.createOrder(mockReq, mockRes, mockNext);

      expect(Order).toHaveBeenCalledWith(expect.objectContaining({
        customerId: orderData.customerId,
        productId: orderData.productId,
        quantity: orderData.quantity,
        amount: orderData.amount,
        orderStatus: 'pending'
      }));
      expect(mockOrder.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        customerId: orderData.customerId,
        orderStatus: 'completed'
      }));
    });

    test('should return 404 if customer not found', async () => {
      const orderData = {
        customerId: 'NONEXISTENT',
        productId: 'PROD001',
        quantity: 2,
        amount: 200
      };
      mockReq.body = orderData;

      // Mock customer service error
      axios.get.mockImplementation((url) => {
        if (url.includes('/customers/')) {
          const error = new Error('Not found');
          error.response = { status: 404 };
          return Promise.reject(error);
        }
        return Promise.resolve({ status: 200 });
      });

      await orderController.createOrder(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Customer not found',
          statusCode: 404
        })
      );
    });

    test('should return 400 for missing required fields', async () => {
      const orderData = {
        customerId: 'CUST001'
        // Missing other required fields
      };
      mockReq.body = orderData;

      await orderController.createOrder(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Missing required order fields',
          statusCode: 400
        })
      );
    });
  });

  describe('getOrderById', () => {
    test('should return order if found', async () => {
      const orderId = 'ORDER001';
      mockReq.params.orderId = orderId;
      
      const order = {
        orderId,
        customerId: 'CUST001',
        productId: 'PROD001',
        quantity: 2,
        amount: 200,
        orderStatus: 'pending'
      };

      Order.findOne.mockResolvedValueOnce(order);

      await orderController.getOrderById(mockReq, mockRes, mockNext);

      expect(Order.findOne).toHaveBeenCalledWith({ orderId });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(order);
    });

    test('should return 404 if order not found', async () => {
      const orderId = 'NONEXISTENT';
      mockReq.params.orderId = orderId;

      Order.findOne.mockResolvedValueOnce(null);

      await orderController.getOrderById(mockReq, mockRes, mockNext);

      expect(Order.findOne).toHaveBeenCalledWith({ orderId });
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Order not found' });
    });
  });

  describe('getOrdersByCustomerId', () => {
    test('should return all orders for a customer', async () => {
      const customerId = 'CUST001';
      mockReq.params.customerId = customerId;

      const orders = [
        { orderId: 'ORDER001', customerId, orderStatus: 'pending' },
        { orderId: 'ORDER002', customerId, orderStatus: 'completed' }
      ];

      Order.find.mockResolvedValueOnce(orders);

      await orderController.getOrdersByCustomerId(mockReq, mockRes, mockNext);

      expect(Order.find).toHaveBeenCalledWith({ customerId });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(orders);
    });

    test('should handle database errors', async () => {
      const customerId = 'CUST001';
      mockReq.params.customerId = customerId;

      const error = new Error('Database error');
      Order.find.mockRejectedValueOnce(error);

      await orderController.getOrdersByCustomerId(mockReq, mockRes, mockNext);

      expect(Order.find).toHaveBeenCalledWith({ customerId });
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});