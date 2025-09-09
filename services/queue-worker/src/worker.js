require('dotenv').config();
const amqp = require('amqplib');
const mongoose = require('mongoose');
const Transaction = require('./models/transaction');
const Order = require('./models/order');
const Product = require('./models/product');

const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://localhost';
const TRANSACTION_QUEUE = process.env.TRANSACTION_QUEUE || 'transaction_queue';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/transaction_db';

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to transaction_db');
  } catch (error) {
    console.error('Could not connect to transaction_db...', error);
    process.exit(1);
  }
}

async function startWorker() {
  await connectDB();

  let connection;
  let channel;
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
          const order = await Order.findOneAndUpdate(
            { orderId: orderId },
            { orderStatus: 'completed', transactionId: transactionId },
            { new: true }
          );
          if (order) {
            console.log(`Order ${orderId} updated to completed.`);
          } else {
            console.warn(`Order ${orderId} not found for status update.`);
          }

          // Update product stock in product-service's database
          // Similar to order update, in a real system, product service would handle this via events.
          await Product.findOneAndUpdate(
            { productId: productId },
            { $inc: { stock: -quantity } }, // Assuming quantity is available in transactionDetails
            { new: true }
          );
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

startWorker();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Queue Worker shutting down...');
  if (channel) await channel.close();
  if (connection) await connection.close();
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Queue Worker shutting down...');
  if (channel) await channel.close();
  if (connection) await connection.close();
  await mongoose.disconnect();
  process.exit(0);
});
