exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request' }) };
  }

  email = (email || '').toLowerCase().trim();
  if (!email || !email.includes('@') || !email.includes('.')) {
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
    if (body.code === '23505') {
      return { statusCode: 200, body: JSON.stringify({ already_exists: true }) };
    }
    console.error('Supabase error:', res.status, body);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
