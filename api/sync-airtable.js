export default async function handler(req, res) {
  // Gestion du CORS et de la méthode POST
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookUrl = process.env.AIRTABLE_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("Variable AIRTABLE_WEBHOOK_URL manquante dans Vercel.");
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`Airtable responded with status ${response.status}`);
    }

    return res.status(200).json({ success: true, message: 'Data synced to Airtable successfully' });
  } catch (error) {
    console.error('Error syncing to Airtable:', error);
    return res.status(500).json({ error: 'Failed to sync data' });
  }
}
