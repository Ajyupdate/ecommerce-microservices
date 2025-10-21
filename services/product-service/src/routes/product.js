const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');


router.post('/', productController.createProduct);


router.get('/:productId', productController.getProductById);


router.get('/', productController.getAllProducts);


router.patch('/:productId/stock', productController.updateProductStock);

module.exports = router;
