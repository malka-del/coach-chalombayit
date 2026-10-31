// Passerelle du jeu « Code Source du Couple » vers le webhook Airtable.
// Durcie : origine contrôlée, taille et forme des données limitées.
// (Aucun secret ne peut être caché dans une page publique : ces garde-fous réduisent les abus, ils ne les suppriment pas.
//  La limite de fréquence est assurée par le pare-feu Vercel.)
const ALLOWED_ORIGINS = [
  'https://coach.chalombayitlelab.com',
  'https://www.coach.chalombayitlelab.com',
];

function sanitize(v, depth = 0) {
  if (typeof v === 'string') return v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 2000);
  if (typeof v === 'number' || typeof v === 'boolean' || v === null) return v;
  if (depth > 2) return undefined;
  if (Array.isArray(v)) return v.slice(0, 100).map((x) => sanitize(x, depth + 1));
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).slice(0, 60)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[String(k).slice(0, 80)] = sanitize(v[k], depth + 1);
    }
    return out;
  }
  return undefined;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(allowed ? 204 : 403).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Bad Request' });
  if (JSON.stringify(body).length > 20000) return res.status(413).json({ error: 'Payload too large' });

  try {
    const airtableWebhookUrl = process.env.AIRTABLE_WEBHOOK_URL;
    if (!airtableWebhookUrl) return res.status(500).json({ error: 'Internal server error' });

    const response = await fetch(airtableWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitize(body)),
    });

    if (response.ok) return res.status(200).json({ success: true });
    return res.status(502).json({ error: 'Airtable error' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
