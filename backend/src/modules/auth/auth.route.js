const express = require('express');
const AuthController = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth');

const router = express.Router();
const authController = new AuthController();

// 1. POST /api/auth/register — Create account
router.post('/register', (req, res) => authController.register(req, res));

// 2. POST /api/auth/login — Log in
router.post('/login', (req, res) => authController.login(req, res));

// 3. GET /api/auth/me — Get profile of logged in user (Protected)
router.get('/me', authenticate, (req, res) => authController.getMe(req, res));

module.exports = router;
