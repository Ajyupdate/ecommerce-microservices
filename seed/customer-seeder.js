require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Customer = require('./models/customer');

const MONGODB_URI = process.env.MONGODB_URI_CUSTOMER || 'mongodb://localhost:27017/customer_db';

const seedCustomers = [
  {
    customerId: 'CUST001',
    name: 'Alice Smith',
    email: 'alice.smith@example.com',
    phone: '+1122334455',
    address: '123 Maple Ave',
  },
  {
    customerId: 'CUST002',
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    phone: '+1987654321',
    address: '456 Oak St',
  },
  {
    customerId: 'CUST003',
    name: 'Charlie Brown',
    email: 'charlie.brown@example.com',
    phone: '+1555123456',
    address: '789 Pine Ln',
  },
];

async function seedDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to customer_db for seeding.');

    await Customer.deleteMany({});
    console.log('Existing customers cleared.');

    await Customer.insertMany(seedCustomers);
    console.log('Customer seed data inserted successfully.');
  } catch (error) {
    console.error('Error seeding customer data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from customer_db.');
  }
}

seedDatabase();
