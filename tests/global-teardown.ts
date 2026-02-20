import { readFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

const PID_FILE = resolve(__dirname, '.dev-pid');

export default async function globalTeardown() {
  if (!existsSync(PID_FILE)) return;

  const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);

  try {
    // Kill the process group (negative PID kills the group)
    process.kill(-pid, 'SIGTERM');
    console.log(`Killed dev server process group (PID ${pid})`);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') {
      console.log('Dev server already stopped');
    } else {
      console.warn(`Failed to kill dev server (PID ${pid}):`, err);
    }
  }

  try {
    unlinkSync(PID_FILE);
  } catch {
    // Ignore cleanup errors
  }
}
