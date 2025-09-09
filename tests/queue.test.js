require('dotenv').config();
const amqp = require('amqplib');
const mongoose = require('mongoose');
const Transaction = require('../src/models/transaction');
const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

// Mock the worker function directly or by importing the worker file and spying on its internals
// For simplicity, let's assume we can mock the core logic directly for testing purposes.
// In a real scenario, you'd likely refactor worker.js to export a function that can be tested.

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_transaction_db';
const QUEUE_NAME = 'transaction_queue';

describe('Queue Worker Tests', () => {
  let connectStub, createChannelStub, assertQueueStub, consumeStub, ackStub, nackStub;
  let mongooseConnectStub, transactionSaveStub, transactionDeleteManyStub;

  beforeEach(() => {
    // Mock RabbitMQ functions
    ackStub = sinon.stub();
    nackStub = sinon.stub();
    consumeStub = sinon.stub();
    assertQueueStub = sinon.stub().resolves();
    createChannelStub = sinon.stub().resolves({
      assertQueue: assertQueueStub,
      consume: consumeStub,
      ack: ackStub,
      nack: nackStub,
      sendToQueue: sinon.stub(), // Add sendToQueue for completeness if needed elsewhere
    });
    connectStub = sinon.stub(amqp, 'connect').resolves({
      createChannel: createChannelStub,
      close: sinon.stub(),
    });

    // Mock Mongoose functions
    mongooseConnectStub = sinon.stub(mongoose, 'connect').resolves();
    transactionSaveStub = sinon.stub(Transaction.prototype, 'save').resolves();
    transactionDeleteManyStub = sinon.stub(Transaction, 'deleteMany').resolves();

    // Clear require cache for the worker to ensure fresh mocks are used each test
    delete require.cache[require.resolve('../src/worker')];
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('RabbitMQ Connection and Message Consumption', () => {
    test('should connect to RabbitMQ and start consuming messages', async () => {
      // Import the worker to trigger its execution
      require('../src/worker');

      await new Promise(resolve => setTimeout(resolve, 100)); // Allow worker to connect

      expect(mongooseConnectStub.calledWith(MONGODB_URI)).to.be.true;
      expect(connectStub.calledWith(RABBITMQ_URL)).to.be.true;
      expect(createChannelStub.calledOnce).to.be.true;
      expect(assertQueueStub.calledWith(QUEUE_NAME, { durable: true })).to.be.true;
      expect(consumeStub.calledOnce).to.be.true;
    });

    test('should process a valid transaction message and ack it', async () => {
      require('../src/worker');
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow worker to connect

      const transactionData = {
        transactionId: 'TRN001',
        customerId: 'CUST001',
        orderId: 'ORD001',
        productId: 'PROD001',
        amount: 100.00,
        paymentMethod: 'credit_card',
        timestamp: new Date().toISOString(),
        status: 'completed'
      };
      const msg = { content: Buffer.from(JSON.stringify(transactionData)) };

      // Simulate receiving a message by calling the consume callback directly
      const consumeCallback = consumeStub.getCall(0).args[0];
      await consumeCallback(msg);

      expect(transactionSaveStub.calledOnce).to.be.true;
      expect(transactionSaveStub.getCall(0).args[0]).to.deep.include(transactionData);
      expect(ackStub.calledWith(msg)).to.be.true;
      expect(nackStub.notCalled).to.be.true;
    });

    test('should nack a malformed message', async () => {
      require('../src/worker');
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow worker to connect

      const malformedMsg = { content: Buffer.from('not json') };

      const consumeCallback = consumeStub.getCall(0).args[0];
      await consumeCallback(malformedMsg);

      expect(transactionSaveStub.notCalled).to.be.true;
      expect(ackStub.notCalled).to.be.true;
      expect(nackStub.calledWith(malformedMsg)).to.be.true;
    });

    test('should nack a message if transaction saving fails', async () => {
      require('../src/worker');
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow worker to connect

      const transactionData = {
        transactionId: 'TRN002',
        customerId: 'CUST002',
        orderId: 'ORD002',
        productId: 'PROD002',
        amount: 50.00,
        paymentMethod: 'debit_card',
        timestamp: new Date().toISOString(),
        status: 'completed'
      };
      const msg = { content: Buffer.from(JSON.stringify(transactionData)) };

      transactionSaveStub.rejects(new Error('Database write error'));

      const consumeCallback = consumeStub.getCall(0).args[0];
      await consumeCallback(msg);

      expect(transactionSaveStub.calledOnce).to.be.true;
      expect(ackStub.notCalled).to.be.true;
      expect(nackStub.calledWith(msg)).to.be.true;
    });

    test('should retry connecting to RabbitMQ on connection error', async () => {
      connectStub.restore(); // Restore the original connect to re-stub it
      const originalSetTimeout = setTimeout;
      const setTimeoutStub = sinon.stub(global, 'setTimeout').callsFake((fn, delay) => {
        if (delay === 5000) {
          // Only resolve the promise when the retry timeout is called
          resolveTimeout();
        }
        return originalSetTimeout(fn, delay); // Call original setTimeout for others
      });

      amqp.connect.onFirstCall().rejects(new Error('RabbitMQ connection failed'));
      amqp.connect.onSecondCall().resolves({
        createChannel: createChannelStub,
        close: sinon.stub(),
      });

      const { startWorker } = require('../src/worker'); // Re-import to get the startWorker function directly

      let resolveTimeout;
      const timeoutPromise = new Promise(resolve => {
        resolveTimeout = resolve;
      });

      startWorker();

      await timeoutPromise; // Wait for the retry timeout to be called

      expect(amqp.connect.callCount).to.be.at.least(2);
      expect(setTimeoutStub.calledWith(expect.any(Function), 5000)).to.be.true;

      setTimeoutStub.restore();
    });

    test('should retry connecting to MongoDB on connection error', async () => {
      mongooseConnectStub.restore();
      const originalSetTimeout = setTimeout;
      const setTimeoutStub = sinon.stub(global, 'setTimeout').callsFake((fn, delay) => {
        if (delay === 5000) {
          resolveTimeout();
        }
        return originalSetTimeout(fn, delay);
      });

      mongoose.connect.onFirstCall().rejects(new Error('MongoDB connection failed'));
      mongoose.connect.onSecondCall().resolves();

      const { startWorker, connectDB } = require('../src/worker'); // Get connectDB as well

      let resolveTimeout;
      const timeoutPromise = new Promise(resolve => {
        resolveTimeout = resolve;
      });

      connectDB(); // Call connectDB directly to test its retry logic

      await timeoutPromise; // Wait for the retry timeout to be called

      expect(mongoose.connect.callCount).to.be.at.least(2);
      expect(setTimeoutStub.calledWith(expect.any(Function), 5000)).to.be.true;

      setTimeoutStub.restore();
    });

  });
});
