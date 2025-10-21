const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const Order = require('../../src/models/order');
const axios = require('axios');

jest.mock('axios');

describe('Order Service Integration Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    jest.setTimeout(30000); // Increase timeout for slow tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    jest.clearAllMocks();
  });

  describe('POST /api/orders', () => {
    it('should create a new order successfully', async () => {
      const orderData = {
        customerId: 'CUST001',
        productId: 'PROD001',
        quantity: 2,
        amount: 199.98
      };

      // Mock successful responses
      axios.get
        .mockImplementationOnce(() => Promise.resolve({
          status: 200,
          data: { id: orderData.customerId }
        }))
        .mockImplementationOnce(() => Promise.resolve({
          status: 200,
          data: { id: orderData.productId, stock: 10 }
        }));

      axios.post.mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: { status: 'success' }
      }));

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(201);

      expect(response.body).toHaveProperty('orderId');
      expect(response.body.customerId).toBe(orderData.customerId);
      expect(response.body.productId).toBe(orderData.productId);
      expect(response.body.quantity).toBe(orderData.quantity);
      expect(response.body.amount).toBe(orderData.amount);

      const savedOrder = await Order.findOne({ orderId: response.body.orderId });
      expect(savedOrder).toBeTruthy();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          customerId: 'CUST001'
          // Missing other required fields
        })
        .expect(400);

      expect(response.body.message).toBe('Missing required order fields');
    });

    it('should return 404 if customer not found', async () => {
      const orderData = {
        customerId: 'NONEXISTENT',
        productId: 'PROD001',
        quantity: 1,
        amount: 99.99
      };

      axios.get.mockRejectedValueOnce({
        response: { status: 404, data: { message: 'Customer not found' } }
      });

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(404);

      expect(response.body.message).toBe('Customer not found');
    });

    it('should return 404 if product not found', async () => {
      const orderData = {
        customerId: 'CUST001',
        productId: 'NONEXISTENT',
        quantity: 1,
        amount: 99.99
      };

      axios.get
        .mockResolvedValueOnce({ status: 200, data: { id: orderData.customerId } })
        .mockRejectedValueOnce({
          response: { status: 404, data: { message: 'Product not found' } }
        });

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(404);

      expect(response.body.message).toBe('Product not found');
    });

    it('should return 400 if insufficient stock', async () => {
      const orderData = {
        customerId: 'CUST001',
        productId: 'PROD001',
        quantity: 10,
        amount: 999.99
      };

      axios.get
        .mockResolvedValueOnce({ status: 200, data: { id: orderData.customerId } })
        .mockResolvedValueOnce({ status: 200, data: { id: orderData.productId, stock: 5 } });

      const response = await request(app)
        .post('/api/orders')
        .send(orderData)
        .expect(400);

      expect(response.body.message).toBe('Insufficient product stock');
    });
  });

  describe('GET /api/orders/:orderId', () => {
    it('should return an order by ID', async () => {
      const testOrder = new Order({
        orderId: `ORD-${Date.now()}`,
        customerId: 'CUST001',
        productId: 'PROD001',
        quantity: 1,
        amount: 99.99,
        orderStatus: 'completed'
      });
      await testOrder.save();

      const response = await request(app)
        .get(`/api/orders/${testOrder.orderId}`)
        .expect(200);

      expect(response.body.orderId).toBe(testOrder.orderId);
      expect(response.body.customerId).toBe(testOrder.customerId);
      expect(response.body.orderStatus).toBe('completed');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app)
        .get('/api/orders/nonexistent-order')
        .expect(404);

      expect(response.body.message).toBe('Order not found');
    });
  });

  describe('GET /api/orders/customer/:customerId', () => {
    it('should return all orders for a customer', async () => {
      const customerId = 'CUST002';
      const testOrders = [
        new Order({
          orderId: `ORD-${Date.now()}-1`,
          customerId,
          productId: 'PROD001',
          quantity: 1,
          amount: 99.99,
          orderStatus: 'completed'
        }),
        new Order({
          orderId: `ORD-${Date.now()}-2`,
          customerId,
          productId: 'PROD002',
          quantity: 2,
          amount: 199.98,
          orderStatus: 'pending'
        })
      ];

      await Promise.all(testOrders.map(order => order.save()));

      const response = await request(app)
        .get(`/api/orders/customer/${customerId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].customerId).toBe(customerId);
      expect(response.body[1].customerId).toBe(customerId);
    });

    it('should return empty array if no orders found', async () => {
      const response = await request(app)
        .get('/api/orders/customer/nonexistent')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });
  });
});