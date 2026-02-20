export const RUN_ID = process.env.RUN_ID || 'local';
export const DATE = new Date().toISOString().slice(0, 10);
export const SCREENSHOT_DIR = `tests/screenshots/${RUN_ID}-${DATE}`;
