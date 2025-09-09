require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Product = require('./models/product');

const MONGODB_URI = process.env.MONGODB_URI_PRODUCT || 'mongodb://localhost:27017/product_db';

const seedProducts = [
  {
    productId: 'PROD001',
    name: 'Laptop',
    description: 'High-performance laptop for gaming and work.',
    price: 1200.00,
    stock: 50,
  },
  {
    productId: 'PROD002',
    name: 'Gaming Mouse',
    description: 'Ergonomic gaming mouse with customizable RGB lighting.',
    price: 75.00,
    stock: 150,
  },
  {
    productId: 'PROD003',
    name: 'Mechanical Keyboard',
    description: 'Tactile mechanical keyboard with durable keycaps.',
    price: 120.00,
    stock: 100,
  },
  {
    productId: 'PROD004',
    name: '4K Monitor',
    description: '27-inch 4K IPS monitor with HDR support.',
    price: 450.00,
    stock: 75,
  },
  {
    productId: 'PROD005',
    name: 'Webcam',
    description: 'Full HD 1080p webcam with built-in microphone.',
    price: 60.00,
    stock: 200,
  },
];

async function seedDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to product_db for seeding.');

    await Product.deleteMany({});
    console.log('Existing products cleared.');

    await Product.insertMany(seedProducts);
    console.log('Product seed data inserted successfully.');
  } catch (error) {
    console.error('Error seeding product data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from product_db.');
  }
}

seedDatabase();
