# `auth.js` middleware guide

This file explains how `BACKEND\middleware\auth.js` works and how to apply it when creating endpoints.

## What `authenticateToken` does

`authenticateToken(req, res, next)` validates the JWT before protected handlers run.

### 1) Reads token sources

It checks these sources in order:

1. `Authorization` header with `Bearer <token>`
2. Cookie named `forgeon_auth_token`

If both exist, the Bearer token is used first.

### 2) Handles missing token

If no token is found, it returns:

```json
{ "message": "Missing authentication token." }
```

with HTTP `401`.

### 3) Checks server secret

It reads `process.env.JWT_SECRET`.  
If missing, it returns HTTP `500` with:

```json
{ "message": "Server JWT secret is not configured." }
```

### 4) Verifies JWT

It calls `jwt.verify(token, JWT_SECRET)`.

- If valid: payload is saved into `req.user`, then `next()` is called.
- If invalid/expired: HTTP `401` with:

```json
{ "message": "Invalid or expired token." }
```

## What is inside `req.user`

Based on token creation in `users_controller.js`, `req.user` includes:

- `userId`
- `username`
- `email`
- standard JWT fields like `iat`, `exp`

Use `req.user.userId` for ownership checks in controllers.

## How to use it in routes

## Pattern A: protect all routes after public ones (recommended)

```js
router.post('/login', loginUser);   // public
router.post('/', createUser);       // public

router.use(authenticateToken);      // everything below requires auth

router.get('/', getUsers);
router.get('/:id', getUserById);
router.patch('/:id', updateUser);
router.delete('/:id', deleteUser);
```

This is the cleanest pattern when a router has a small set of public endpoints and many protected ones.

## Pattern B: protect specific endpoints only

```js
router.get('/public-feed', getPublicFeed);
router.get('/me', authenticateToken, getCurrentUser);
```

Use this when protected and public endpoints are mixed.

## Notes for endpoint developers

1. Keep `login/register` public (define them **before** `router.use(authenticateToken)` if using Pattern A).
2. Do not trust client-sent user IDs when auth exists; prefer `req.user.userId`.
3. For browser page navigation protection, cookie JWT is useful because browsers send cookies automatically.
4. For API clients/tools, Bearer token in `Authorization` is usually the best option.
