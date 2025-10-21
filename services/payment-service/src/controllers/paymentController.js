const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://localhost';
const TRANSACTION_QUEUE = process.env.TRANSACTION_QUEUE || 'transaction_queue';


exports.processPayment = async (req, res, next) => {
  try {
    const { customerId, orderId, productId, amount, paymentMethod } = req.body;
    
    // Validate required fields
    if (!customerId || !orderId || !productId || !amount || !paymentMethod) {
      const error = new Error('Missing required payment fields');
      error.statusCode = 400;
      return next(error);
    }

    // Simulate payment processing logic
    const transactionId = uuidv4();
    const paymentStatus = 'completed'; // For demo, always successful

    const transactionDetails = {
      transactionId,
      orderId,
      customerId,
      productId,
      amount,
      paymentMethod,
      paymentStatus,
      timestamp: new Date().toISOString(),
    };

    // Publish transaction details to RabbitMQ
    const connection = await amqp.connect(RABBITMQ_URI);
    const channel = await connection.createChannel();
    await channel.assertQueue(TRANSACTION_QUEUE, { durable: true });
    channel.sendToQueue(TRANSACTION_QUEUE, Buffer.from(JSON.stringify(transactionDetails)), {
      persistent: true,
    });
    console.log(`Transaction ${transactionId} published to queue.`);
    await channel.close();
    await connection.close();

    res.status(200).json({ message: 'Payment processed and transaction published.', transactionId });
  } catch (error) {
    console.error('Error processing payment or publishing to RabbitMQ:', error);
    if (error.statusCode === 400) {
      next(error);
    } else {
      const err = new Error('Payment processing failed or queue connection error');
      err.statusCode = 500;
      next(err);
    }
  }
};
