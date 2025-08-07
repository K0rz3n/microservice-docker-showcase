// upstream-service entry
const express = require('express');
const os = require('os');
const dns = require('dns').promises;
const cfg = require('./config.json');

const {
  service_name: SERVICE_TAG,
  name: RAW_NAME,
  port: PORT,
  address: ADDRESS,
  target: TARGETS = [],
} = cfg;
if (typeof RAW_NAME !== 'string' || !RAW_NAME.trim())
  throw new Error('config.name must be a non-empty string');
const NAME = RAW_NAME.replace(/^\/+/, '');

const SELF_IP =
  Object.values(os.networkInterfaces())
    .flat()
    .find(n => n.family === 'IPv4' && !n.internal)?.address || 'unknown';

const app = express();
app.disable('x-powered-by');

// ---- helpers ------
const resolveIP = async h => {
  try {
    const [a] = await dns.resolve4(h);
    return a;
  } catch {
    try {
      const { address } = await dns.lookup(h, { family: 4 });
      return address;
    } catch {
      return 'unknown';
    }
  }
};

const fanOut = msg => {
  if (!msg.startsWith('Success')) return;
  TARGETS.forEach(({ address, port, name }) =>
    (async () => {
      const ip = await resolveIP(address);
      const url = `http://${address}:${port}/${name}`;
      try {
        const r = await fetch(url, { headers: { 'x-source-service': SERVICE_TAG } });
        console.log(`[Inner] ${SERVICE_TAG} -> ${address}(${ip}) ${url}`);
        if (!r.ok) console.log(`[Error] ${url} status ${r.status}`);
      } catch (e) {
        console.log(`[Error] ${url} ${e.message}`);
      }
    })(),
  );
};

const payload = msg => {
  fanOut(msg);
  return { message: msg };
};

// ---- routes ------
app.get(`/${NAME}`, (req, res) => {
  const caller = req.get('x-source-service')?.trim();
  const src = caller || req.ip;
  if (!caller)
    console.log(`[Request] ${src} -> ${SERVICE_TAG} http://${SELF_IP}:${PORT}/${NAME}`);
  const msg = `Success: http://${SELF_IP}:${PORT}/${NAME} accessed by ${src}`;
  res.json(payload(msg));
});

app.use((req, res) => {
  const src = req.get('x-source-service')?.trim() || req.ip;
  console.log(`[404] ${src} -> ${SERVICE_TAG} http://${SELF_IP}:${PORT}${req.path}`);
  res.status(404).json(
    payload(`Error: http://${SELF_IP}:${PORT}/${NAME} miss the path!`),
  );
});

// ---- start -----
app.listen(PORT, ADDRESS, () =>
  console.log(`[Upstream] ${SERVICE_TAG} listening on http://${SELF_IP}:${PORT}/${NAME}`),
);