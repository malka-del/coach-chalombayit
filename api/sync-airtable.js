export default async function handler(req, res) {
  // 1. Autorisations CORS complètes pour intercepter le domaine custom sans blocage
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Gestion de la requête de pré-vérification (Preflight Request OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Validation de la méthode
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const data = req.body;

    // 4. Envoi vers le Webhook Airtable configuré dans Vercel
    const AIRTABLE_WEBHOOK_URL = process.env.AIRTABLE_WEBHOOK_URL;

    if (!AIRTABLE_WEBHOOK_URL) {
      return res.status(500).json({ error: 'Variable AIRTABLE_WEBHOOK_URL manquante dans Vercel' });
    }

    const airtableResponse = await fetch(AIRTABLE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (airtableResponse.ok) {
      return res.status(200).json({ success: true, message: 'Données transmises avec succès à Airtable' });
    } else {
      return res.status(500).json({ error: 'Erreur retournée par le Webhook Airtable' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
