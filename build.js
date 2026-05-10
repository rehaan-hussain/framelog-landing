const fs = require('fs');
const path = require('path');

// Load .env when running locally (Netlify injects env vars automatically)
if (fs.existsSync(path.join(__dirname, '.env'))) {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k) process.env[k] = v;
    });
}

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_ANON_KEY not set — waitlist form will run in demo mode.');
}

// Build dist/
if (!fs.existsSync('dist')) fs.mkdirSync('dist');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/__SUPABASE_URL__/g,      url);
html = html.replace(/__SUPABASE_ANON_KEY__/g, key);
fs.writeFileSync('dist/index.html', html);

fs.copyFileSync('logo.svg', 'dist/logo.svg');
fs.copyFileSync('google432a398d7170998a.html', 'dist/google432a398d7170998a.html');

console.log('Build complete → dist/');
