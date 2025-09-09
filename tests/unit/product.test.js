const productController = require('../../src/controllers/productController');
const Product = require('../../src/models/product');

// Mock the Product model
jest.mock('../../src/models/product');

describe('Product Controller Unit Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    test('should create a new product and return 201', async () => {
      const newProductData = {
        productId: 'PROD001',
        name: 'Test Product',
        price: 10.00,
        stock: 100,
      };
      mockReq.body = newProductData;

      const savedProduct = { ...newProductData, _id: 'someId' };
      Product.mockImplementationOnce(() => ({
        save: jest.fn().mockResolvedValueOnce(savedProduct),
      }));

      await productController.createProduct(mockReq, mockRes, mockNext);

      expect(Product).toHaveBeenCalledWith(newProductData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(savedProduct);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if product creation fails', async () => {
      const newProductData = {
        productId: 'PROD001',
        name: 'Test Product',
        price: 10.00,
        stock: 100,
      };
      mockReq.body = newProductData;

      const error = new Error('Database error');
      Product.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValueOnce(error),
      }));

      await productController.createProduct(mockReq, mockRes, mockNext);

      expect(Product).toHaveBeenCalledWith(newProductData);
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('getProductById', () => {
    test('should return 200 and the product if found', async () => {
      const productId = 'PROD001';
      mockReq.params = { productId };
      const foundProduct = { productId, name: 'Test Product' };

      Product.findOne.mockResolvedValueOnce(foundProduct);

      await productController.getProductById(mockReq, mockRes, mockNext);

      expect(Product.findOne).toHaveBeenCalledWith({ productId });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(foundProduct);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 404 if product not found', async () => {
      const productId = 'NONEXISTENT';
      mockReq.params = { productId };

      Product.findOne.mockResolvedValueOnce(null);

      await productController.getProductById(mockReq, mockRes, mockNext);

      expect(Product.findOne).toHaveBeenCalledWith({ productId });
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Product not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if database query fails', async () => {
      const productId = 'PROD001';
      mockReq.params = { productId };

      const error = new Error('Database error');
      Product.findOne.mockRejectedValueOnce(error);

      await productController.getProductById(mockReq, mockRes, mockNext);

      expect(Product.findOne).toHaveBeenCalledWith({ productId });
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('getAllProducts', () => {
    test('should return 200 and all products', async () => {
      const allProducts = [
        { productId: 'PROD001', name: 'Product 1' },
        { productId: 'PROD002', name: 'Product 2' },
      ];

      Product.find.mockResolvedValueOnce(allProducts);

      await productController.getAllProducts(mockReq, mockRes, mockNext);

      expect(Product.find).toHaveBeenCalledWith();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(allProducts);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if database query fails', async () => {
      const error = new Error('Database error');
      Product.find.mockRejectedValueOnce(error);

      await productController.getAllProducts(mockReq, mockRes, mockNext);

      expect(Product.find).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('updateProductStock', () => {
    test('should update product stock and return 200', async () => {
      const productId = 'PROD001';
      const newStock = 90;
      mockReq.params = { productId };
      mockReq.body = { stock: newStock };
      const updatedProduct = { productId, name: 'Test Product', stock: newStock };

      Product.findOneAndUpdate.mockResolvedValueOnce(updatedProduct);

      await productController.updateProductStock(mockReq, mockRes, mockNext);

      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { productId },
        { stock: newStock },
        { new: true, runValidators: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(updatedProduct);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 404 if product not found for stock update', async () => {
      const productId = 'NONEXISTENT';
      const newStock = 90;
      mockReq.params = { productId };
      mockReq.body = { stock: newStock };

      Product.findOneAndUpdate.mockResolvedValueOnce(null);

      await productController.updateProductStock(mockReq, mockRes, mockNext);

      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { productId },
        { stock: newStock },
        { new: true, runValidators: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Product not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if stock update fails', async () => {
      const productId = 'PROD001';
      const newStock = 90;
      mockReq.params = { productId };
      mockReq.body = { stock: newStock };

      const error = new Error('Database error');
      Product.findOneAndUpdate.mockRejectedValueOnce(error);

      await productController.updateProductStock(mockReq, mockRes, mockNext);

      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { productId },
        { stock: newStock },
        { new: true, runValidators: true }
      );
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });
});
