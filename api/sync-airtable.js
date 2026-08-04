module.exports = async (req, res) => {
  // Définition des entêtes CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Gestion des requêtes de pré-vérification (Preflight OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Si ce n'est pas une requête POST, rejeter
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookUrl = process.env.AIRTABLE_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error("Variable AIRTABLE_WEBHOOK_URL manquante sur Vercel.");
    return res.status(500).json({ error: 'Server environment variable missing' });
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
      throw new Error(`Airtable HTTP error: ${response.status}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur lors de l’envoi à Airtable:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
