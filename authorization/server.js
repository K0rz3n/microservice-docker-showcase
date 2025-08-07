// auth-service entry
const express = require('express');
const os = require('os');
const {
  name: SERVICE_NAME,
  service_name: SERVICE_TAG,
  port: PORT,
  address: ADDRESS,            // kept for completeness; bind “0.0.0.0” in compose
} = require('./config.json');

const app = express();

// container IPv4
const INSTANCE_IP =
  Object.values(os.networkInterfaces())
    .flat()
    .find(n => n.family === 'IPv4' && !n.internal)?.address || 'unknown';

// ---------- routes ----------
app.get('/auth', (req, res) => {
  const caller = req.get('x-source-service')?.trim();
  const msg = caller
    ? `Request through ${caller} is authed`
    : 'Error: missing required header x-source-service';
  res.json({ message: msg });
});

app.use((req, res) => {
  res
    .status(404)
    .json({
      message: `Error: ${SERVICE_TAG} URL http://${INSTANCE_IP}:${PORT}/auth miss the path!`,
    });
});

// ---------- bootstrap ----------
app.listen(PORT, () =>
  console.log(
    `[Auth] ${SERVICE_TAG} listening on http://${INSTANCE_IP}:${PORT}/auth`,
  ),
);