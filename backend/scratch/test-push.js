const http = require('http');

const payload = {
  serverId: "aws-ec2-prod-01",
  apiKey: "default-secure-key-123",
  metrics: {
    hostname: "aws-ec2-prod-01.us-east-1",
    os: {
      distro: "Ubuntu 22.04 LTS",
      platform: "linux",
      uptime: 864500
    },
    cpu: {
      usage: 74.5,
      cores: 4,
      speed: 3.1,
      model: "Intel Xeon Platinum 8000"
    },
    memory: {
      total: 17179869184, // 16 GB
      used: 12884901888,  // 12 GB
      free: 4294967296,   // 4 GB
      usagePercent: 75.0
    },
    disks: [{
      fs: "ext4",
      mount: "/",
      size: 53687091200,  // 50 GB
      used: 32212254720,  // 30 GB
      usagePercent: 60.0
    }],
    network: {
      rx_sec: 1450000,
      tx_sec: 980000,
      rx_bytes: 5410000000,
      tx_bytes: 4200000000,
      interface: "eth0"
    },
    temperatures: [{ label: "CPU Package", main: 54.2 }],
    services: [
      { name: "nginx", running: true },
      { name: "docker", running: true },
      { name: "postgresql", running: true }
    ],
    status: "online"
  }
};

const reqData = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/metrics/push',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(reqData)
  }
};

console.log("📡 Sending mock remote agent push to http://localhost:5000/api/metrics/push...");

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`RESPONSE: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`❌ Request failed: ${e.message}`);
});

req.write(reqData);
req.end();
