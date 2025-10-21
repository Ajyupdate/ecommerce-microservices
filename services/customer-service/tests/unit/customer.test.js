const customerController = require('../../src/controllers/customerController');
const Customer = require('../../src/models/customer');

// Mock the Customer model
jest.mock('../../src/models/customer');

describe('Customer Controller Unit Tests', () => {
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

  describe('createCustomer', () => {
    test('should create a new customer and return 201', async () => {
      const newCustomerData = {
        customerId: 'CUST001',
        name: 'Test Customer',
        email: 'test@example.com',
      };
      mockReq.body = newCustomerData;

      const mockCustomer = {
        ...newCustomerData,
        save: jest.fn().mockResolvedValueOnce()
      };
      Customer.mockImplementationOnce(() => mockCustomer);

      await customerController.createCustomer(mockReq, mockRes, mockNext);

      expect(Customer).toHaveBeenCalledWith(newCustomerData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockCustomer);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if customer creation fails', async () => {
      const newCustomerData = {
        customerId: 'CUST001',
        name: 'Test Customer',
        email: 'test@example.com',
      };
      mockReq.body = newCustomerData;

      const error = new Error('Database error');
      Customer.mockImplementationOnce(() => ({
        save: jest.fn().mockRejectedValueOnce(error),
      }));

      await customerController.createCustomer(mockReq, mockRes, mockNext);

      expect(Customer).toHaveBeenCalledWith(newCustomerData);
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('getCustomerById', () => {
    test('should return 200 and the customer if found', async () => {
      const customerId = 'CUST001';
      mockReq.params = { customerId };
      const foundCustomer = { customerId, name: 'Test Customer' };

      Customer.findOne.mockResolvedValueOnce(foundCustomer);

      await customerController.getCustomerById(mockReq, mockRes, mockNext);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(foundCustomer);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 404 if customer not found', async () => {
      const customerId = 'NONEXISTENT';
      mockReq.params = { customerId };

      Customer.findOne.mockResolvedValueOnce(null);

      await customerController.getCustomerById(mockReq, mockRes, mockNext);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId });
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Customer not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if database query fails', async () => {
      const customerId = 'CUST001';
      mockReq.params = { customerId };

      const error = new Error('Database error');
      Customer.findOne.mockRejectedValueOnce(error);

      await customerController.getCustomerById(mockReq, mockRes, mockNext);

      expect(Customer.findOne).toHaveBeenCalledWith({ customerId });
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('getAllCustomers', () => {
    test('should return 200 and all customers', async () => {
      const allCustomers = [
        { customerId: 'CUST001', name: 'Customer 1' },
        { customerId: 'CUST002', name: 'Customer 2' },
      ];

      Customer.find.mockResolvedValueOnce(allCustomers);

      await customerController.getAllCustomers(mockReq, mockRes, mockNext);

      expect(Customer.find).toHaveBeenCalledWith();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(allCustomers);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if database query fails', async () => {
      const error = new Error('Database error');
      Customer.find.mockRejectedValueOnce(error);

      await customerController.getAllCustomers(mockReq, mockRes, mockNext);

      expect(Customer.find).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });
});
