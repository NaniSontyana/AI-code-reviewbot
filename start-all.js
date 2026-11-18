const { spawn } = require('child_process');
const path = require('path');

console.log("\x1b[36m%s\x1b[0m", "=================================================");
console.log("\x1b[35m%s\x1b[0m", "  ⚡ Launching AI Code Review Suite (DevMind)   ");
console.log("\x1b[36m%s\x1b[0m", "=================================================\n");

// 1. Launch Backend API Gateway
const backendDir = path.join(__dirname, 'backend');
const backend = spawn('node', ['server.js'], {
  cwd: backendDir,
  shell: true,
  env: process.env
});

backend.stdout.on('data', (data) => {
  const line = data.toString().trim();
  if (line) console.log(`\x1b[34m[Backend]\x1b[0m ${line}`);
});

backend.stderr.on('data', (data) => {
  const line = data.toString().trim();
  if (line) console.error(`\x1b[31m[Backend Error]\x1b[0m ${line}`);
});

// 2. Launch Frontend (Vite)
const frontendDir = path.join(__dirname, 'fronend');
const frontend = spawn('npx', ['vite', '--host'], {
  cwd: frontendDir,
  shell: true,
  env: process.env
});

frontend.stdout.on('data', (data) => {
  const line = data.toString().trim();
  if (line) console.log(`\x1b[32m[Frontend]\x1b[0m ${line}`);
});

frontend.stderr.on('data', (data) => {
  const line = data.toString().trim();
  if (line) console.error(`\x1b[33m[Frontend Info]\x1b[0m ${line}`);
});

// Handle termination signals
process.on('SIGINT', () => {
  console.log("\nStopping all services...");
  backend.kill();
  frontend.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  backend.kill();
  frontend.kill();
  process.exit(0);
});
