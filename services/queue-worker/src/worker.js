require('dotenv').config();
const amqp = require('amqplib');
const mongoose = require('mongoose');
const Transaction = require('./models/transaction');
// Order model will be set globally after connection
// Product model will be set globally after connection

const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://localhost';
const TRANSACTION_QUEUE = process.env.TRANSACTION_QUEUE || 'transaction_queue';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transaction_db';

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

// Global variables for cleanup
let connection;
let channel;

async function connectDB() {
  try {
    // In test environment, mongoose is already connected to the test database
    if (process.env.NODE_ENV !== 'test') {
      // Connect to transaction database
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to transaction_db');
      
      // Connect to product database
      const productConnection = await mongoose.createConnection(process.env.MONGODB_URI_PRODUCT);
      console.log('Connected to product_db');
      
      // Connect to order database
      const orderConnection = await mongoose.createConnection(process.env.MONGODB_URI_ORDER);
      console.log('Connected to order_db');
      
      // Create Product model with product connection
      const Product = productConnection.model('Product', require('./models/product').schema);
      global.Product = Product;  // Make it available globally
      
      // Create Order model with order connection
      const Order = orderConnection.model('Order', require('./models/order').schema);
      global.Order = Order;  // Make it available globally
    } else {
      // For testing, use the same connection for all models
      global.Product = mongoose.model('Product', require('./models/product').schema);
      global.Order = mongoose.model('Order', require('./models/order').schema);
    }
  } catch (error) {
    console.error('Could not connect to databases...', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    } else {
      throw error;
    }
  }
}

async function startWorker() {
  await connectDB();

  try {
    connection = await amqp.connect(RABBITMQ_URI);
    channel = await connection.createChannel();
    await channel.assertQueue(TRANSACTION_QUEUE, { durable: true });
    channel.prefetch(1); // Process one message at a time

    console.log(`Queue Worker waiting for messages in ${TRANSACTION_QUEUE}. To exit press CTRL+C`);

    channel.consume(TRANSACTION_QUEUE, async (msg) => {
      if (msg !== null) {
        const content = msg.content.toString();
        const transactionDetails = JSON.parse(content);
        const { transactionId, orderId, customerId, productId, amount, paymentMethod, paymentStatus } = transactionDetails;

        console.log(`Processing transaction: ${transactionId} for Order: ${orderId}`);

        try {
          // Save transaction details to transaction_db
          const newTransaction = new Transaction({
            transactionId,
            orderId,
            customerId,
            productId,
            amount,
            paymentMethod,
            paymentStatus,
          });
          await newTransaction.save();
          console.log(`Transaction ${transactionId} saved to transaction_db.`);

          // Update order status in order-service's database
          // NOTE: In a real microservices setup, the Order Service would ideally listen for payment events
          // to update its own state, rather than the Queue Worker directly updating it.
          // For this example, we're simplifying by directly updating the Order model.
          console.log(`Attempting to update order: ${orderId}`);
          const order = await global.Order.findOneAndUpdate(
            { orderId: orderId },
            { orderStatus: 'completed', transactionId: transactionId },
            { new: true }
          );
          console.log('Order after update:', order)
          if (!order) {
            throw new Error(`Order ${orderId} not found for status update.`);
          }
          console.log(`Order ${orderId} updated to completed.`);

          // Update product stock in product-service's database
          // Similar to order update, in a real system, product service would handle this via events.
          const product = await Product.findOneAndUpdate(
            { productId: productId },
            { $inc: { stock: -1 } },
            { new: true }
          );

          if (!product) {
            throw new Error(`Product ${productId} not found for stock update.`);
          }
          console.log(`Product ${productId} stock updated.`);

          channel.ack(msg);
          console.log(`Transaction ${transactionId} processed successfully.`);
        } catch (error) {
          console.error(`Error processing transaction ${transactionId}:`, error);

          const retries = msg.properties.headers['x-death']
            ? msg.properties.headers['x-death'][0].count
            : 0;

          if (retries < MAX_RETRIES) {
            console.log(`Retrying transaction ${transactionId} in ${RETRY_DELAY / 1000} seconds. Attempt ${retries + 1}/${MAX_RETRIES}`);
            setTimeout(() => {
              channel.publish(
                '', // Default exchange
                TRANSACTION_QUEUE, // Re-queue to the same queue
                Buffer.from(content),
                { headers: { 'x-retries': retries + 1 }, persistent: true }
              );
              channel.ack(msg);
            }, RETRY_DELAY);
          } else {
            console.error(`Max retries reached for transaction ${transactionId}. Moving to dead-letter or manual intervention.`);
            // Implement dead-letter queue logic here if necessary
            channel.reject(msg, false); // Discard message (or send to dead-letter queue)
          }
        }
      }
    }, { noAck: false });

  } catch (error) {
    console.error('Failed to connect to RabbitMQ or start worker:', error);
    setTimeout(startWorker, RETRY_DELAY); // Retry connection after a delay
  }
}

// Only start the worker if this file is being run directly
if (require.main === module) {
  startWorker();
}

module.exports = {
  startWorker,
  shutdown,
  connectDB
};

// Handle graceful shutdown
async function shutdown(signal) {
  console.log(`Queue Worker shutting down... (${signal})`);
  try {
    // Wait for any in-progress operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (channel) {
      console.log('Closing RabbitMQ channel...');
      await channel.close();
    }
    if (connection) {
      console.log('Closing RabbitMQ connection...');
      await connection.close();
    }
    console.log('Disconnecting from MongoDB...');
    
    // Close all connections in test environment
    if (process.env.NODE_ENV === 'test') {
      const connections = mongoose.connections;
      await Promise.all(connections.map(conn => conn.close()));
    }

    await mongoose.disconnect();
    console.log('Shutdown completed successfully');

    // Only exit in non-test environment
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    } else {
      throw error;
    }
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
