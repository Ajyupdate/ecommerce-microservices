const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');




router.post('/', orderController.createOrder);


router.get('/:orderId', orderController.getOrderById);


router.get('/customer/:customerId', orderController.getOrdersByCustomerId);

module.exports = router;
