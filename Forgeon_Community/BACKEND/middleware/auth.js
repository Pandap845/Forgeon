

const jwt = require('jsonwebtoken');

// Name of the cookie where the JWT may be stored
const AUTH_COOKIE_NAME = 'forgeon_auth_token';

// Middleware function for authentication lol
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
    // Get the Authorization header from the request
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieHeader = req.get('cookie') || '';
  const cookieToken = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  const tokenFromCookie = cookieToken ? decodeURIComponent(cookieToken.slice(AUTH_COOKIE_NAME.length + 1)) : null;
  const token = bearerToken || tokenFromCookie;

    // If no token was found, reject the request
  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }

    // Get the JWT secret key from environment variables
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Server JWT secret is not configured.' });
  }

   // Verify the token using the secret key
    // If valid, attach the decoded payload to the request object and call next()
  try {
    const payload = jwt.verify(token, secret);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = {
  authenticateToken,
};
