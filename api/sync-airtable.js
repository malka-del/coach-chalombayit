
export default async function handler(req, res) {
  // On accepte uniquement les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // L'URL secrète de ton Webhook Airtable (stockée dans Vercel)
  const AIRTABLE_WEBHOOK_URL = process.env.AIRTABLE_WEBHOOK_URL;

  if (!AIRTABLE_WEBHOOK_URL) {
    return res.status(500).json({ error: 'URL Webhook manquante sur le serveur' });
  }

  try {
    const payload = req.body;

    // Transfert sécurisé vers Airtable
    const response = await fetch(AIRTABLE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload)
    });

    if (response.ok) {
      return res.status(200).json({ success: true, message: 'Données transmises à Airtable' });
    } else {
      return res.status(500).json({ error: 'Erreur lors de l’envoi à Airtable' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
}
