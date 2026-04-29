// Dependencies
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const usersRoutes = require('./users');
const { loginUser } = require('../controllers/users_controller');

// API Router
const routerApi = express.Router();

function hasValidJwt(req) {
  const authHeader = req.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const xAuthToken = req.get('x-auth');
  const token = bearerToken || xAuthToken;

  if (!token || !process.env.JWT_SECRET) {
    return false;
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch (_error) {
    return false;
  }
}

routerApi.use('/users', usersRoutes);
routerApi.post('/login', loginUser);

// Routes
routerApi.get('/home.html', (req, res) => {
  if (!hasValidJwt(req)) {
    return res.redirect('/login.html');
  }

  return res.sendFile(path.resolve(__dirname, '../../FRONTEND/views/Home/homepage.html'));
});

routerApi.get('/homepage.html', (req, res) => {
  if (!hasValidJwt(req)) {
    return res.redirect('/login.html');
  }

  return res.sendFile(path.resolve(__dirname, '../../FRONTEND/views/Home/homepage.html'));
});

routerApi.get('/login.html', (req, res) => {
  if (hasValidJwt(req)) {
    return res.redirect('/homepage.html');
  }

  return res.sendFile(path.resolve(__dirname, '../../FRONTEND/views/Login_Register/login.html'));
});

routerApi.get('/register.html', (req, res) => {
  if (hasValidJwt(req)) {
    return res.redirect('/homepage.html');
  }

  return res.sendFile(path.resolve(__dirname, '../../FRONTEND/views/Login_Register/register.html'));
});

routerApi.get('/', (req, res) => {
  if (hasValidJwt(req)) {
    return res.redirect('/homepage.html');
  }

  return res.redirect('/login.html');
});

module.exports = routerApi;
