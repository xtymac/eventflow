/**
 * Environment detection utilities for feature flags and environment-specific behavior
 */

/**
 * Detects if the current environment is a demo environment.
 *
 * Uses a combination of:
 * 1. Whitelist from VITE_DEMO_DOMAINS (comma-separated, supports domain changes)
 * 2. Hardcoded default hostname (demo.eventflow.uixai.org)
 * 3. Build-time flag VITE_IS_DEMO for local development
 *
 * @returns true if running in demo environment
 */
export function isDemoEnvironment(): boolean {
  // Build-time flag takes priority (for local development)
  if (import.meta.env.VITE_IS_DEMO === 'true') {
    return true;
  }

  // Check whitelist (for domain changes/staging)
  const whitelist = import.meta.env.VITE_DEMO_DOMAINS?.split(',') || [];
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // P1修复: 精确匹配或子域名匹配,防止误匹配 demo.eventflow.uixai.org.evil.com
    if (whitelist.some(domain => {
      const trimmed = domain.trim();
      return hostname === trimmed || hostname.endsWith('.' + trimmed);
    })) {
      return true;
    }

    // Default: exact match only
    return hostname === 'demo.eventflow.uixai.org';
  }

  return false;
}

/**
 * Feature flag for admin navigation panel.
 *
 * Provides a kill switch to disable the admin demo navigation feature
 * without requiring code changes.
 *
 * Set VITE_ENABLE_ADMIN_NAV=false to disable.
 * Defaults to enabled (true).
 *
 * @returns true if admin navigation is enabled (default), false if disabled
 */
export function isAdminNavEnabled(): boolean {
  // Kill switch - explicitly check for 'false' string
  // Defaults to enabled if env var is not set
  return import.meta.env.VITE_ENABLE_ADMIN_NAV !== 'false';
}
