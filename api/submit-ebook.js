/* ========================================================================= */
/* VERCEL SERVERLESS FUNCTION : /api/submit-ebook.js                         */
/* Passerelle sécurisée : masque le Webhook Make & transmet les données     */
/* ========================================================================= */

module.exports = async function handler(req, res) {
  // 1. En-têtes CORS complets pour autoriser les appels depuis coach.chalombayitlelab.com
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Réponse immédiate pour les requêtes de pré-vol OPTIONS du navigateur
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Méthode non autorisée (POST uniquement)' });
  }

  try {
    const { prenom, email, telephone } = req.body || {};

    // Validation des champs indispensables
    if (!prenom || !email) {
      return res.status(400).json({ success: false, message: 'Le prénom et l’email sont requis.' });
    }

    // Récupération de l'URL secrète stockée dans les variables d'environnement Vercel
    const makeWebhookUrl = process.env.MAKE_EBOOK_WEBHOOK;

    if (!makeWebhookUrl) {
      console.error('Erreur critique : La variable MAKE_EBOOK_WEBHOOK n’est pas configurée sur Vercel.');
      return res.status(500).json({
        success: false,
        message: 'Configuration serveur incomplète (variable webhook manquante sur Vercel).'
      });
    }

    // 2. Transmission directe et sécurisée des données au Webhook Make
    const makeResponse = await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prenom: String(prenom).trim(),
        email: String(email).trim().toLowerCase(),
        telephone: telephone ? String(telephone).trim() : null,
        source: 'ebook_tichri_site',
        timestamp: new Date().toISOString()
      })
    });

    if (!makeResponse.ok) {
      const errText = await makeResponse.text();
      console.error('Make a répondu avec une erreur :', makeResponse.status, errText);
      return res.status(502).json({
        success: false,
        message: `Erreur renvoyée par Make (${makeResponse.status})`
      });
    }

    // 3. Confirmation de succès renvoyée au popup du site
    return res.status(200).json({
      success: true,
      message: 'Demande transmise avec succès à Make.'
    });

  } catch (error) {
    console.error('Erreur interne submit-ebook :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors de la transmission.'
    });
  }
};
