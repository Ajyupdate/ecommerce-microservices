const request = require('supertest');
const app = require('../../services/order-service/src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Order = require('../../services/order-service/src/models/order');
const axios = require('axios');

// Set test environment
process.env.NODE_ENV = 'test';

jest.mock('axios'); // Mock axios for integration tests as we don't want to call external services

describe('Order Service Integration Tests', () => {
  jest.setTimeout(30000); // Increase timeout to 30 seconds
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('POST /api/orders should create a new order', async () => {
    const newOrder = {
      customerId: 'CUST001',
      productId: 'PROD001',
      quantity: 2,
      amount: 199.98,
    };

    // Mock successful responses from customer and product services
    axios.get.mockImplementation((url) => {
      if (url.includes('customers')) {
        return Promise.resolve({ status: 200, data: { customerId: newOrder.customerId } });
      } else if (url.includes('products')) {
        return Promise.resolve({ status: 200, data: { productId: newOrder.productId, stock: 10 } });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    axios.post.mockResolvedValueOnce({ status: 200 }); // Mock payment service call

    const response = await request(app)
      .post('/api/orders')
      .send(newOrder)
      .expect(201);

    expect(response.body).toHaveProperty('orderId');
    expect(response.body.customerId).toBe(newOrder.customerId);
    expect(response.body.productId).toBe(newOrder.productId);
    expect(response.body.quantity).toBe(newOrder.quantity);
    expect(response.body.amount).toBe(newOrder.amount);
    expect(response.body.orderStatus).toBe('pending');
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('POST /api/orders should return 400 for missing fields', async () => {
    const newOrder = { customerId: 'CUST001' }; // Missing product, quantity, amount

    const response = await request(app)
      .post('/api/orders')
      .send(newOrder)
      .expect(400);

    expect(response.body.message).toBe('Missing required order fields');
  });

  test('POST /api/orders should return 404 if customer not found', async () => {
    const newOrder = {
      customerId: 'NONEXISTENT',
      productId: 'PROD001',
      quantity: 1,
      amount: 100,
    };

    // Mock customer not found with error response
    axios.get.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { message: 'Customer not found' }
      }
    });

    const response = await request(app)
      .post('/api/orders')
      .send(newOrder)
      .expect(404);

    expect(response.body.message).toBe('Customer not found');
  });

  test('POST /api/orders should return 404 if product not found', async () => {
    const newOrder = {
      customerId: 'CUST001',
      productId: 'NONEXISTENT',
      quantity: 1,
      amount: 100,
    };

    axios.get.mockImplementationOnce(() => Promise.resolve({ status: 200, data: { customerId: newOrder.customerId } })); // Mock customer found
    axios.get.mockImplementationOnce(() => Promise.reject({
      response: {
        status: 404,
        data: { message: 'Product not found' }
      }
    })); // Mock product not found

    const response = await request(app)
      .post('/api/orders')
      .send(newOrder)
      .expect(404);

    expect(response.body.message).toBe('Product not found');
  });

  test('POST /api/orders should return 400 if insufficient stock', async () => {
    const newOrder = {
      customerId: 'CUST001',
      productId: 'PROD001',
      quantity: 10,
      amount: 100,
    };

    axios.get.mockResolvedValueOnce({ status: 200, data: { customerId: newOrder.customerId } });
    axios.get.mockResolvedValueOnce({ status: 200, data: { productId: newOrder.productId, stock: 5 } }); // Mock insufficient stock

    const response = await request(app)
      .post('/api/orders')
      .send(newOrder)
      .expect(400);

    expect(response.body.message).toBe('Insufficient product stock');
  });

  test('GET /api/orders/:orderId should return an order', async () => {
    const testOrder = {
      orderId: `ORD-${Date.now()}`,
      customerId: 'CUST001',
      productId: 'PROD001',
      quantity: 1,
      amount: 99.99,
      orderStatus: 'completed'
    };
    const order = new Order(testOrder);
    await order.save();    const response = await request(app)
      .get(`/api/orders/${order.orderId}`)
      .expect(200);

    expect(response.body.orderId).toBe(order.orderId);
    expect(response.body.customerId).toBe(order.customerId);
  });

  test('GET /api/orders/:orderId should return 404 if order not found', async () => {
    const response = await request(app)
      .get('/api/orders/NONEXISTENT')
      .expect(404);

    expect(response.body.message).toBe('Order not found');
  });

  test('GET /api/orders/customer/:customerId should return orders for a customer', async () => {
    const customerId = 'CUST002';
    const testOrders = [
      new Order({
        orderId: `ORD-${Date.now()}-1`,
        customerId,
        productId: 'PROD002',
        quantity: 1,
        amount: 50.00,
        orderStatus: 'pending'
      }),
      new Order({
        orderId: `ORD-${Date.now()}-2`,
        customerId,
        productId: 'PROD003',
        quantity: 2,
        amount: 120.00,
        orderStatus: 'completed'
      })
    ];
    
    await Promise.all(testOrders.map(order => order.save()));

    const response = await request(app)
      .get(`/api/orders/customer/${customerId}`)
      .expect(200);

    expect(response.body.length).toBe(2);
    expect(response.body[0].customerId).toBe(customerId);
  });

  test('GET /api/orders/customer/:customerId should return empty array if no orders for customer', async () => {
    const response = await request(app)
      .get('/api/orders/customer/NONEXISTENT')
      .expect(200);

    expect(response.body).toEqual([]);
  });
});
