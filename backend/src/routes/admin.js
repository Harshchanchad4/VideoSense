const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const { listUsers, updateUserRole, deleteUser, getStats } = require('../controllers/adminController');

// All admin routes require authentication and admin role
router.use(auth, requireRole('admin'));

router.get('/users', listUsers);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);
router.get('/stats', getStats);

module.exports = router;
