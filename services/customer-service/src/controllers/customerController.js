const Customer = require('../models/customer');


exports.createCustomer = async (req, res, next) => {
  try {
    const newCustomer = new Customer(req.body);
    await newCustomer.save();
    res.status(201).json(newCustomer);
  } catch (error) {
    next(error);
  }
};


exports.getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not foundttsssd11' });
    }
    res.status(200).json(customer);
  } catch (error) {
    next(error);
  }
};


exports.getAllCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find();
    res.status(200).json(customers);
  } catch (error) {
    next(error);
  }
};
