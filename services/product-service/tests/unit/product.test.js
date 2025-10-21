const { createProduct, getProductById, getAllProducts, updateProductStock } = require('../../src/controllers/productController');
const Product = require('../../src/models/product');

// Mock the Product model
jest.mock('../../src/models/product');

describe('Product Controller Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    it('should create a new product successfully', async () => {
      const productData = {
        productId: 'test-prod-1',
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 100
      };
      mockReq.body = productData;

      const mockProduct = { ...productData };
      const mockSave = jest.fn().mockResolvedValue(mockProduct);
      Product.mockImplementation(() => ({ save: mockSave, ...mockProduct }));

      await createProduct(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining(productData));
      expect(mockSave).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      
      Product.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(error)
      }));

      await createProduct(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getProductById', () => {
    it('should return product if found', async () => {
      const product = {
        productId: 'test-prod-1',
        name: 'Test Product'
      };
      mockReq.params.productId = 'test-prod-1';

      Product.findOne.mockResolvedValue(product);

      await getProductById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(product);
    });

    it('should return 404 if product not found', async () => {
      mockReq.params.productId = 'non-existent-id';
      Product.findOne.mockResolvedValue(null);

      await getProductById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Product not found' });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockReq.params.productId = 'test-prod-1';
      Product.findOne.mockRejectedValue(error);

      await getProductById(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getAllProducts', () => {
    it('should return all products', async () => {
      const products = [
        { productId: 'test-prod-1', name: 'Product 1' },
        { productId: 'test-prod-2', name: 'Product 2' }
      ];
      Product.find.mockResolvedValue(products);

      await getAllProducts(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(products);
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      Product.find.mockRejectedValue(error);

      await getAllProducts(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProductStock', () => {
    it('should update product stock successfully', async () => {
      const updatedProduct = {
        productId: 'test-prod-1',
        name: 'Test Product',
        stock: 50
      };
      mockReq.params.productId = 'test-prod-1';
      mockReq.body = { stock: 50 };

      Product.findOneAndUpdate.mockResolvedValue(updatedProduct);

      await updateProductStock(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(updatedProduct);
      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { productId: 'test-prod-1' },
        { stock: 50 },
        { new: true, runValidators: true }
      );
    });

    it('should return 404 if product not found', async () => {
      mockReq.params.productId = 'non-existent-id';
      mockReq.body = { stock: 50 };

      Product.findOneAndUpdate.mockResolvedValue(null);

      await updateProductStock(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Product not found' });
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      mockReq.params.productId = 'test-prod-1';
      mockReq.body = { stock: -1 };

      Product.findOneAndUpdate.mockRejectedValue(error);

      await updateProductStock(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});