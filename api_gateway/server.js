// -------------------- Config --------------------
const express = require('express');
const os = require('os');
const dns = require('dns').promises;
const { randomUUID } = require('crypto');
const config = require('./config.json');

const {
  name: GATEWAY_NAME,
  service_name: GATEWAY_SERVICE,
  port: GATEWAY_PORT,
  address: GATEWAY_ADDRESS,
  registrants = [],
  dependencies = [],
} = config;

// -------------------- Utils --------------------
const INSTANCE = process.env.INSTANCE_TAG || process.env.HOSTNAME || os.hostname();

const getSelfIPv4 = () => {
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'unknown';
};
const INSTANCE_IP = getSelfIPv4();
const SELF_URL = `http://${INSTANCE}(${INSTANCE_IP}):${GATEWAY_PORT}`; // gateway base URL

const resolveIPv4 = async host => {
  try {
    const [addr] = await dns.resolve4(host);
    return addr;
  } catch {
    try {
      const { address } = await dns.lookup(host, { family: 4 });
      return address;
    } catch {
      return 'unknown';
    }
  }
};

class AuthError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'AuthError';
  }
}

// -------------------- App Init --------------------
const app = express();
app.set('trust proxy', true);
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[Query] Client(${req.ip}) -> ${SELF_URL}${req.originalUrl}`);
  next();
});

// -------------------- Helpers --------------------
const verifyDependencies = async headers => {
  await Promise.all(
    dependencies.map(async ({ address, port, path }) => {
      const url = `http://${address}:${port}/${path}`;
      const res = await fetch(url, { headers }).catch(e => {
        throw new AuthError(`Auth request failed: ${e.message}`);
      });
      if (!res?.ok) throw new AuthError(`Auth error! Status ${res.status}`);
    }),
  );
};

// -------------------- Routes --------------------
app.get('/api/serverList', (_req, res) => {
  res.json(
    registrants.map(r => ({
      API: `http://localhost/api/${r.api_path}`,
    })),
  );
});

app.get('/api/:service', async (req, res) => {
  const { service } = req.params;
  const target = registrants.find(r => r.api_name === service);
  if (!target) return res.status(404).json({ error: `Service '${service}' not found` });

  const headers = { 'x-source-service': GATEWAY_SERVICE };

  try { 
    await verifyDependencies(headers);

    const targetIP = await resolveIPv4(target.api_address);
    const targetURL = `http://${target.api_address}:${target.api_port}/${target.api_path}`;
    console.log(`[Proxy] ${INSTANCE} -> ${target.api_address}(${targetIP}) ${targetURL}`);

    const response = await fetch(targetURL, { headers });
    if (!response.ok) return res.status(502).json({ error: `Upstream error ${response.status}` });

    const data = await response.json().catch(() => ({}));
    return res.json(data);
  } catch (err) {
    if (err instanceof AuthError) return res.status(403).json({ error: err.message });
    console.error(err.message);
    return res.status(502).json({ error: `Unable to access service '${service}'` });
  }
});

// -------------------- 404 --------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: `${req.method} ${req.originalUrl}` });
});

// -------------------- Start --------------------
app.listen(GATEWAY_PORT, () => {
  console.log(`[Gateway] ${INSTANCE}(${INSTANCE_IP}) listening on http://${GATEWAY_ADDRESS}:${GATEWAY_PORT}`);
});
