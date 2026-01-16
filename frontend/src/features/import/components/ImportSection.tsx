/**
 * Import Section Component
 *
 * Wrapper for ImportVersionList with compact display.
 */

import { ImportVersionList } from '../ImportVersionList';

export function ImportSection() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ImportVersionList compact />
    </div>
  );
}
