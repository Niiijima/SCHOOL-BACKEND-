const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController'); 


router.post('/register', adminController.registerAdmin);
router.post('/login', adminController.loginAdmin);

router.get('/test', (req, res) => {
    res.send('Admin route is working!');
});

module.exports = router;