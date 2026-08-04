export default async function handler(req, res) {
  // Autoriser l'origine exacte du frontend
  res.setHeader('Access-Control-Allow-Origin', 'https://coach.chalombayitlelab.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Réponse immédiate pour le Preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const airtableWebhookUrl = process.env.AIRTABLE_WEBHOOK_URL;

    const response = await fetch(airtableWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(response.status).json({ error: 'Airtable error' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
