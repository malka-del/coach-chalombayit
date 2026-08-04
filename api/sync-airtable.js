export default async function handler(req, res) {
  // 1. Définir les autorisations CORS (Permet à ton domaine de contacter Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Répondre immédiatement "OK" aux requêtes de pré-vérification du navigateur
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Bloquer si ce n'est pas une requête POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const data = req.body;

    // 4. Envoi vers le Webhook Airtable
    const AIRTABLE_WEBHOOK_URL = process.env.AIRTABLE_WEBHOOK_URL;

    const airtableResponse = await fetch(AIRTABLE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (airtableResponse.ok) {
      return res.status(200).json({ success: true, message: 'Données envoyées à Airtable' });
    } else {
      return res.status(500).json({ error: 'Erreur lors de l’envoi vers Airtable' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
