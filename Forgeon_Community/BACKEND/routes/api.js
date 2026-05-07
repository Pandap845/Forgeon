// Dependencies
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const usersRoutes = require('./users');
const { loginUser } = require('../controllers/users_controller');
const AUTH_COOKIE_NAME = 'forgeon_auth_token';

// API Router
const routerApi = express.Router();


function hasValidJwt(req) {
  const authHeader = req.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieHeader = req.get('cookie') || '';
  const cookieToken = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  const tokenFromCookie = cookieToken ? decodeURIComponent(cookieToken.slice(AUTH_COOKIE_NAME.length + 1)) : null;
  const token = bearerToken || tokenFromCookie;

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

function sendView(res, viewRelativePath) {
  return res.sendFile(path.resolve(__dirname, `../../FRONTEND/views/${viewRelativePath}`));
}

function registerProtectedView(router, paths, viewRelativePath) {
  paths.forEach((routePath) => {
    router.get(routePath, (req, res) => {
      if (!hasValidJwt(req)) {
        return res.redirect('/login.html');
      }
      return sendView(res, viewRelativePath);
    });
  });
}

function registerGuestOnlyView(router, paths, viewRelativePath) {
  paths.forEach((routePath) => {
    router.get(routePath, (req, res) => {
      if (hasValidJwt(req)) {
        return res.redirect('/homepage.html');
      }
      return sendView(res, viewRelativePath);
    });
  });
}

function registerPublicView(router, paths, viewRelativePath) {
  paths.forEach((routePath) => {
    router.get(routePath, (_req, res) => sendView(res, viewRelativePath));
  });
}

routerApi.use('/users', usersRoutes);
routerApi.post('/login', loginUser);

// Routes
registerProtectedView(routerApi, ['/home.html', '/homepage.html', '/Home/homepage.html'], 'Home/homepage.html');
registerProtectedView(routerApi, ['/forumpage.html', '/Home/forumpage.html'], 'Home/forumpage.html');
registerProtectedView(routerApi, ['/threadview.html', '/Home/threadview.html'], 'Home/threadview.html');
registerProtectedView(routerApi, ['/profile.html', '/Profile/profile.html'], 'Profile/profile.html');
registerProtectedView(routerApi, ['/forums.html', '/Home/forums.html'], 'Home/forums.html');

registerProtectedView(routerApi, ['/discover_groups.html', '/Groups/discover_groups.html'], 'Groups/discover_groups.html');
registerProtectedView(routerApi, ['/friend_requests.html', '/Groups/friend_requests.html'], 'Groups/friend_requests.html');
registerProtectedView(routerApi, ['/group_Creation.html', '/Groups/group_Creation.html'], 'Groups/group_Creation.html');
registerProtectedView(routerApi, ['/group_detail.html', '/Groups/group_detail.html'], 'Groups/group_detail.html');
registerProtectedView(routerApi, ['/group_invitations.html', '/Groups/group_invitations.html'], 'Groups/group_invitations.html');
registerProtectedView(routerApi, ['/group_management.html', '/Groups/group_management.html'], 'Groups/group_management.html');
registerProtectedView(routerApi, ['/group_settings.html', '/Groups/group_settings.html'], 'Groups/group_settings.html');
registerProtectedView(routerApi, ['/search.html', '/Groups/search.html'], 'Groups/search.html');
registerProtectedView(routerApi, ['/user_groups.html', '/Groups/user_groups.html'], 'Groups/user_groups.html');

registerGuestOnlyView(routerApi, ['/login.html', '/Login_Register/login.html'], 'Login_Register/login.html');
registerGuestOnlyView(routerApi, ['/register.html', '/Login_Register/register.html'], 'Login_Register/register.html');
registerPublicView(routerApi, ['/privacy.html', '/Login_Register/privacy.html'], 'Login_Register/privacy.html');
registerPublicView(routerApi, ['/terms.html', '/Login_Register/terms.html'], 'Login_Register/terms.html');

routerApi.get('/', (req, res) => {
  if (hasValidJwt(req)) {
    return res.redirect('/homepage.html');
  }

  return res.redirect('/login.html');
});

module.exports = routerApi;
