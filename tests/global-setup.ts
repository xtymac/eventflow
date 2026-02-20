import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const PID_FILE = resolve(__dirname, '.dev-pid');
const HEALTH_URL = 'http://localhost:5173';
const TIMEOUT_MS = 60_000;

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup() {
  // Skip if CI or external server is already running
  if (process.env.SKIP_DEV_SERVER) return;

  try {
    const res = await fetch(HEALTH_URL);
    if (res.ok) {
      console.log('Dev server already running, skipping startup');
      return;
    }
  } catch {
    // Not running, start it
  }

  console.log('Starting dev server (npm run dev)...');
  const child = spawn('npm', ['run', 'dev'], {
    cwd: resolve(__dirname, '..'),
    stdio: 'pipe',
    detached: true,
  });

  if (!child.pid) {
    throw new Error('Failed to start dev server');
  }

  // Store PID for teardown
  writeFileSync(PID_FILE, String(child.pid));
  child.unref();

  await waitForServer(HEALTH_URL, TIMEOUT_MS);
  console.log('Dev server ready');
}
