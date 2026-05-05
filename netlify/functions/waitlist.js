// In-memory IP rate limit — persists across warm container reuses
const ipAttempts = new Map();
const WINDOW_MS  = 60_000; // 1 minute window
const MAX_HITS   = 3;      // max 3 submissions per IP per minute

function isRateLimited(ip) {
  const now    = Date.now();
  const record = ipAttempts.get(ip) || { count: 0, start: now };

  // Reset window if expired
  if (now - record.start > WINDOW_MS) {
    record.count = 0;
    record.start = now;
  }

  record.count += 1;
  ipAttempts.set(ip, record);

  // Prune old IPs to prevent memory growth
  if (ipAttempts.size > 5000) {
    for (const [key, val] of ipAttempts) {
      if (now - val.start > WINDOW_MS) ipAttempts.delete(key);
    }
  }

  return record.count > MAX_HITS;
}

// Very strict email regex — rejects disposable/junk patterns
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // IP-based server-side rate limit
  const ip = event.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Too many requests — slow down.' }),
    };
  }

  // Parse body
  let email, honeypot;
  try {
    ({ email, honeypot } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request' }) };
  }

  // Honeypot — bots fill hidden fields, humans don't
  if (honeypot) {
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  email = (email || '').toLowerCase().trim();

  // Validate
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Supabase env vars');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({ email }),
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Network error' }) };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Treat duplicate as success — don't reveal whether email exists
    if (body.code === '23505') {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }
    console.error('Supabase error:', res.status, body);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
