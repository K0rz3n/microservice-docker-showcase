// basic-service entry
const express = require('express');
const os = require('os');
const cfg = require('./config.json');

const { port: PORT, address: ADDRESS, name: RAW_NAME } = cfg;
if (typeof RAW_NAME !== 'string' || !RAW_NAME.trim())
  throw new Error('config.name must be a non-empty string');

const NAME = RAW_NAME.replace(/^\/+/, ''); // drop leading slash

const getIPv4 = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .find(n => n.family === 'IPv4' && !n.internal)?.address || 'unknown';
const SELF_IP = getIPv4();

const app = express();
app.disable('x-powered-by');

// main endpoint
app.get(`/${NAME}`, (_req, res) => res.json({ message: NAME }));

// fallback 404
app.use((req, res) =>
  res.status(404).json({ message: `Error: ${req.method} ${req.originalUrl} not found` }),
);

// start
app.listen(PORT, ADDRESS, () =>
  console.log(`[Basic] ${NAME} listening on http://${SELF_IP}:${PORT}/${NAME}`),
);