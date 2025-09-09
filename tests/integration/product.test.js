const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const Product = require('../../src/models/product');

describe('Product Service Integration Tests', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test_product_db');
  });

  afterEach(async () => {
    await Product.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('POST /api/products should create a new product', async () => {
    const newProduct = {
      productId: 'PROD001',
      name: 'Test Product',
      description: 'A test product',
      price: 10.00,
      stock: 100,
      category: 'Electronics',
    };

    const response = await request(app)
      .post('/api/products')
      .send(newProduct)
      .expect(201);

    expect(response.body.productId).toBe(newProduct.productId);
    expect(response.body.name).toBe(newProduct.name);
  });

  test('GET /api/products/:productId should return a product', async () => {
    const product = await Product.create({
      productId: 'PROD002',
      name: 'Another Product',
      price: 20.00,
      stock: 50,
    });

    const response = await request(app)
      .get(`/api/products/${product.productId}`)
      .expect(200);

    expect(response.body.productId).toBe(product.productId);
    expect(response.body.name).toBe(product.name);
  });

  test('GET /api/products should return all products', async () => {
    await Product.create({ productId: 'PROD003', name: 'Product 3', price: 30, stock: 30 });
    await Product.create({ productId: 'PROD004', name: 'Product 4', price: 40, stock: 40 });

    const response = await request(app)
      .get('/api/products')
      .expect(200);

    expect(response.body.length).toBe(2);
  });

  test('PUT /api/products/:productId/stock should update product stock', async () => {
    const product = await Product.create({
      productId: 'PROD005',
      name: 'Product 5',
      price: 50,
      stock: 50,
    });

    const newStock = 45;
    const response = await request(app)
      .put(`/api/products/${product.productId}/stock`)
      .send({ stock: newStock })
      .expect(200);

    expect(response.body.stock).toBe(newStock);
  });

  test('PUT /api/products/:productId/stock should return 404 if product not found', async () => {
    const newStock = 40;
    await request(app)
      .put('/api/products/NONEXISTENT/stock')
      .send({ stock: newStock })
      .expect(404);
  });
});
