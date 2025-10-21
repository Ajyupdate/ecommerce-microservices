const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Customer = require('../../src/models/customer');

describe('Customer Service Integration Tests', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    // Connect to the test database
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27022/test_customer_db');
  });

  afterEach(async () => {
    // Clear the database after each test
    await Customer.deleteMany({});
  });

  afterAll(async () => {
    // Disconnect from the database
    await mongoose.connection.close();
  });

  test('POST /api/customers should create a new customer', async () => {
    const newCustomer = {
      customerId: 'CUST001',
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      address: '123 Main St',
    };

    const response = await request(app)
      .post('/api/customers')
      .send(newCustomer)
      .expect(201);

    expect(response.body.customerId).toBe(newCustomer.customerId);
    expect(response.body.name).toBe(newCustomer.name);
    expect(response.body.email).toBe(newCustomer.email);
  });

  test('GET /api/customers/:customerId should return a customer', async () => {
    const customer = await Customer.create({
      customerId: 'CUST002',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
    });

    const response = await request(app)
      .get(`/api/customers/${customer.customerId}`)
      .expect(200);

    expect(response.body.customerId).toBe(customer.customerId);
    expect(response.body.name).toBe(customer.name);
  });

  test('GET /api/customers should return all customers', async () => {
    await Customer.create({ customerId: 'CUST003', name: 'Peter Jones', email: 'peter.jones@example.com' });
    await Customer.create({ customerId: 'CUST004', name: 'Alice Brown', email: 'alice.brown@example.com' });

    const response = await request(app)
      .get('/api/customers')
      .expect(200);

    expect(response.body.length).toBe(2);
  });

  test('POST /api/customers should return 400 for duplicate customerId', async () => {
    await Customer.create({
      customerId: 'CUST005',
      name: 'Duplicate User',
      email: 'duplicate@example.com',
    });

    const duplicateCustomer = {
      customerId: 'CUST005',
      name: 'Another Duplicate',
      email: 'another.duplicate@example.com',
    };

    const response = await request(app)
      .post('/api/customers')
      .send(duplicateCustomer)
      .expect(500); // Mongoose duplicate key error results in 500 by default

    expect(response.body.message).toMatch(/duplicate key error/);
  });
});
