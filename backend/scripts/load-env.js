/**
 * Minimal .env loader for standalone scripts.
 *
 * Next.js loads .env automatically for API routes, but the init/seed scripts
 * run as plain Node processes, so they need the environment populated first.
 * This avoids adding a dotenv dependency for a tiny parse job.
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
