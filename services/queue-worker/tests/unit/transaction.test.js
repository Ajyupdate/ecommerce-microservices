const mongoose = require('mongoose');
const Transaction = require('../../src/models/transaction');

describe('Transaction Model Unit Tests', () => {
  describe('Transaction Schema', () => {
    it('should have required fields', () => {
      const transaction = new Transaction({});
      const validationError = transaction.validateSync();

      const requiredFields = [
        'transactionId',
        'orderId',
        'customerId',
        'productId',
        'amount',
        'paymentMethod'
      ];

      for (const field of requiredFields) {
        expect(validationError.errors[field]).toBeDefined();
        expect(validationError.errors[field].kind).toBe('required');
      }
    });

    it('should validate successfully with valid data', () => {
      const validTransaction = new Transaction({
        transactionId: 'test-trans-1',
        orderId: 'test-order-1',
        customerId: 'test-cust-1',
        productId: 'test-prod-1',
        amount: 99.99,
        paymentMethod: 'credit_card',
        paymentStatus: 'completed'
      });

      const validationError = validTransaction.validateSync();
      expect(validationError).toBeUndefined();
    });

    it('should validate paymentMethod enum values', () => {
      const invalidTransaction = new Transaction({
        transactionId: 'test-trans-1',
        orderId: 'test-order-1',
        customerId: 'test-cust-1',
        productId: 'test-prod-1',
        amount: 99.99,
        paymentMethod: 'invalid_method',
        paymentStatus: 'completed'
      });

      const validationError = invalidTransaction.validateSync();
      expect(validationError.errors.paymentMethod).toBeDefined();
    });

    it('should validate paymentStatus enum values', () => {
      const invalidTransaction = new Transaction({
        transactionId: 'test-trans-1',
        orderId: 'test-order-1',
        customerId: 'test-cust-1',
        productId: 'test-prod-1',
        amount: 99.99,
        paymentMethod: 'credit_card',
        paymentStatus: 'invalid_status'
      });

      const validationError = invalidTransaction.validateSync();
      expect(validationError.errors.paymentStatus).toBeDefined();
    });

    it('should require positive amount', () => {
      const invalidTransaction = new Transaction({
        transactionId: 'test-trans-1',
        orderId: 'test-order-1',
        customerId: 'test-cust-1',
        productId: 'test-prod-1',
        amount: -99.99,
        paymentMethod: 'credit_card',
        paymentStatus: 'completed'
      });

      const validationError = invalidTransaction.validateSync();
      expect(validationError.errors.amount).toBeDefined();
    });
  });
});