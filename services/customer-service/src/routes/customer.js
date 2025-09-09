const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');


 
router.post('/', customerController.createCustomer);


router.get('/:customerId', customerController.getCustomerById);


router.get('/', customerController.getAllCustomers);

module.exports = router;
