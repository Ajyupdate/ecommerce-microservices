const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Product = require('../../src/models/product');

let mongoServer;

beforeAll(async () => {
  // Create an in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections before each test
  await Product.deleteMany({});
});

describe('Product Service Integration Tests', () => {
  describe('POST /api/products', () => {
    it('should create a new product successfully', async () => {
      const productData = {
        productId: 'test-prod-1',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 100
      };

      const response = await request(app)
        .post('/api/products')
        .send(productData)
        .expect(201);

      expect(response.body).toMatchObject(productData);
      expect(response.body._id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();

      // Verify the product was actually saved
      const savedProduct = await Product.findOne({ productId: productData.productId });
      expect(savedProduct).toBeTruthy();
      expect(savedProduct.name).toBe(productData.name);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        productId: 'test-prod-1',
        // Missing other required fields
      };

      const response = await request(app)
        .post('/api/products')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/validation failed/i);
    });

    it('should return 400 for invalid stock value', async () => {
      const invalidData = {
        productId: 'test-prod-1',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: -1 // Invalid stock value
      };

      const response = await request(app)
        .post('/api/products')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/validation failed/i);
    });
  });

  describe('GET /api/products/:productId', () => {
    it('should return a product by ID', async () => {
      // First create a product
      const product = await Product.create({
        productId: 'test-prod-1',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 100
      });

      const response = await request(app)
        .get(`/api/products/${product.productId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        productId: product.productId,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock
      });
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/api/products/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Product not found');
    });
  });

  describe('GET /api/products', () => {
    it('should return all products', async () => {
      // Create test products
      const products = await Product.insertMany([
        {
          productId: 'test-prod-1',
          name: 'Test Product 1',
          description: 'Description 1',
          price: 99.99,
          stock: 100
        },
        {
          productId: 'test-prod-2',
          name: 'Test Product 2',
          description: 'Description 2',
          price: 149.99,
          stock: 50
        }
      ]);

      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        productId: products[0].productId,
        name: products[0].name
      });
      expect(response.body[1]).toMatchObject({
        productId: products[1].productId,
        name: products[1].name
      });
    });

    it('should return empty array when no products exist', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('PATCH /api/products/:productId/stock', () => {
    it('should update product stock', async () => {
      // Create a test product
      const product = await Product.create({
        productId: 'test-prod-1',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 100
      });

      const newStock = 50;
      const response = await request(app)
        .patch(`/api/products/${product.productId}/stock`)
        .send({ stock: newStock })
        .expect(200);

      expect(response.body.stock).toBe(newStock);

      // Verify the stock was actually updated in the database
      const updatedProduct = await Product.findOne({ productId: product.productId });
      expect(updatedProduct.stock).toBe(newStock);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .patch('/api/products/non-existent-id/stock')
        .send({ stock: 50 })
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Product not found');
    });

    it('should return 400 for invalid stock value', async () => {
      // Create a test product
      const product = await Product.create({
        productId: 'test-prod-1',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 100
      });

      const response = await request(app)
        .patch(`/api/products/${product.productId}/stock`)
        .send({ stock: -1 })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toMatch(/validation failed/i);
    });
  });
});