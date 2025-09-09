const orderController = require('../../src/controllers/orderController');
const Order = require('../../src/models/order');
const axios = require('axios');

jest.mock('../../src/models/order');
jest.mock('axios');

describe('Order Controller Unit Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    process.env.CUSTOMER_SERVICE_URL = 'http://localhost:3001';
    process.env.PRODUCT_SERVICE_URL = 'http://localhost:3002';
    process.env.PAYMENT_SERVICE_URL = 'http://localhost:3004';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    test('should create a new order and return 201 if services are up', async () => {
      const orderData = {
        customerId: 'CUST001',
        productId: 'PROD001',
        quantity: 2,
        amount: 199.98,
      };
      mockReq.body = orderData;

      axios.get.mockImplementation((url) => {
        if (url.includes('customers')) {
          return Promise.resolve({ status: 200, data: { customerId: orderData.customerId } });
        } else if (url.includes('products')) {
          return Promise.resolve({ status: 200, data: { productId: orderData.productId, stock: 10 } });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      axios.post.mockResolvedValueOnce({ status: 200 }); // Mock payment service call

      const savedOrder = { ...orderData, orderId: 'ORD-123', orderStatus: 'pending' };
      Order.mockImplementationOnce(() => ({
        save: jest.fn().mockResolvedValueOnce(savedOrder),
      }));

      await orderController.createOrder(mockReq, mockRes, mockNext);

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(axios.get).toHaveBeenCalledWith(`${process.env.CUSTOMER_SERVICE_URL}/api/customers/${orderData.customerId}`);
      expect(axios.get).toHaveBeenCalledWith(`${process.env.PRODUCT_SERVICE_URL}/api/products/${orderData.productId}`);
      expect(Order).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(savedOrder);
      expect(mockNext).not.toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalledWith(`${process.env.PAYMENT_SERVICE_URL}/api/payments`, expect.any(Object));
    });

    test('should return 400 if required fields are missing', async () => {
      mockReq.body = { customerId: 'CUST001' }; // Missing productId, quantity, amount

      await orderController.createOrder(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'Missing required order fields' }));
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    test('should return 404 if customer not found', async () => {
      const orderData = {
        customerId: 'NONEXISTENT',
        productId: 'PROD001',
        quantity: 1,
        amount: 100,
      };
      mockReq.body = orderData;

      axios.get.mockResolvedValueOnce({ status: 404 }); // Customer not found

      await orderController.createOrder(mockReq, mockRes, mockNext);

      expect(axios.get).toHaveBeenCalledWith(`${process.env.CUSTOMER_SERVICE_URL}/api/customers/${orderData.customerId}`);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'Customer not found' }));
    });

    test('should return 404 if product not found', async () => {
      const orderData = {
        customerId: 'CUST001',
        productId: 'NONEXISTENT',
        quantity: 1,
        amount: 100,
      };
      mockReq.body = orderData;

      axios.get.mockResolvedValueOnce({ status: 200, data: { customerId: orderData.customerId } }); // Customer found
      axios.get.mockResolvedValueOnce({ status: 404 }); // Product not found

      await orderController.createOrder(mockReq, mockRes, mockNext);

      expect(axios.get).toHaveBeenCalledWith(`${process.env.PRODUCT_SERVICE_URL}/api/products/${orderData.productId}`);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'Product not found' }));
    });

    test('should return 400 if insufficient product stock', async () => {
      const orderData = {
        customerId: 'CUST001',
        productId: 'PROD001',
        quantity: 10,
        amount: 100,
      };
      mockReq.body = orderData;

      axios.get.mockResolvedValueOnce({ status: 200, data: { customerId: orderData.customerId } });
      axios.get.mockResolvedValueOnce({ status: 200, data: { productId: orderData.productId, stock: 5 } }); // Insufficient stock

      await orderController.createOrder(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'Insufficient product stock' }));
    });

    test('should call next with error if order saving fails', async () => {
      const orderData = {
        customerId: 'CUST001',
        productId: 'PROD001',
        quantity: 2,
        amount: 199.98,
      };
      mockReq.body = orderData;

      axios.get.mockImplementation((url) => {
        if (url.includes('customers')) {
          return Promise.resolve({ status: 200, data: { customerId: orderData.customerId } });
        } else if (url.includes('products')) {
          return Promise.resolve({ status: 200, data: { productId: orderData.productId, stock: 10 } });
        }
      });
      const error = new Error('Database save error');
      Order.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValueOnce(error),
      }));

      await orderController.createOrder(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('getOrderById', () => {
    test('should return 200 and the order if found', async () => {
      const orderId = 'ORD001';
      mockReq.params = { orderId };
      const foundOrder = { orderId, customerId: 'CUST001' };

      Order.findOne.mockResolvedValueOnce(foundOrder);

      await orderController.getOrderById(mockReq, mockRes, mockNext);

      expect(Order.findOne).toHaveBeenCalledWith({ orderId });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(foundOrder);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 404 if order not found', async () => {
      const orderId = 'NONEXISTENT';
      mockReq.params = { orderId };

      Order.findOne.mockResolvedValueOnce(null);

      await orderController.getOrderById(mockReq, mockRes, mockNext);

      expect(Order.findOne).toHaveBeenCalledWith({ orderId });
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Order not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if database query fails', async () => {
      const orderId = 'ORD001';
      mockReq.params = { orderId };

      const error = new Error('Database error');
      Order.findOne.mockRejectedValueOnce(error);

      await orderController.getOrderById(mockReq, mockRes, mockNext);

      expect(Order.findOne).toHaveBeenCalledWith({ orderId });
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('getOrdersByCustomerId', () => {
    test('should return 200 and all orders for a customer', async () => {
      const customerId = 'CUST001';
      mockReq.params = { customerId };
      const customerOrders = [
        { orderId: 'ORD001', customerId, productId: 'PROD001' },
        { orderId: 'ORD002', customerId, productId: 'PROD002' },
      ];

      Order.find.mockResolvedValueOnce(customerOrders);

      await orderController.getOrdersByCustomerId(mockReq, mockRes, mockNext);

      expect(Order.find).toHaveBeenCalledWith({ customerId });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(customerOrders);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if database query fails', async () => {
      const customerId = 'CUST001';
      mockReq.params = { customerId };

      const error = new Error('Database error');
      Order.find.mockRejectedValueOnce(error);

      await orderController.getOrdersByCustomerId(mockReq, mockRes, mockNext);

      expect(Order.find).toHaveBeenCalledWith({ customerId });
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });
});
