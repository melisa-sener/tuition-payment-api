const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');

const app = express();

// Your backend URL (index.js app)
const TARGET = 'http://localhost:3000';

// ---------- Logging middleware ----------
app.use((req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;
  const ip = req.ip;
  const headers = req.headers;
  const reqSize = req.headers['content-length'] || 0;

  res.on('finish', () => {
    const latency = Date.now() - start;
    const status = res.statusCode;
    const resSize = res.getHeader('content-length') || 0;
    const authStatus =
      status === 401 || status === 403 ? 'AUTH_FAILED' : 'AUTH_OK';

    const logEntry = {
      method,
      path: originalUrl,
      timestamp: new Date().toISOString(),
      ip,
      reqSize,
      headers,
      status,
      latencyMs: latency,
      resSize,
      authStatus,
    };

    console.log('GATEWAY_LOG', JSON.stringify(logEntry));
  });

  next();
});

// ---------- Rate limiting ----------
const limiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute window
  max: 20,                 // max 20 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// ---------- Proxy all routes to backend ----------
app.use(
  '/',
  createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
  })
);

const port = process.env.GATEWAY_PORT || 4000;
app.listen(port, () => {
  console.log(`API Gateway running on port ${port}, proxying to ${TARGET}`);
});