/* ========================================================================= */
/* VERCEL SERVERLESS FUNCTION : /api/submit-ebook.js                         */
/* Compatible avec les nouveaux jetons Airtable Personal Access Tokens (pat_)*/
/* ========================================================================= */

module.exports = async function handler(req, res) {
  // Gestion CORS pour requêtes pré-vol OPTIONS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

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
      return res.status(400).json({ success: false, message: 'Le prénom et l\'email sont requis.' });
    }

    const emailClean = String(email).trim().toLowerCase();
    const prenomClean = String(prenom).trim();
    const telClean = telephone ? String(telephone).trim() : '';

    const airtableToken = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_TABLE_NAME || 'Couples et CRM';
    const makeWebhookUrl = process.env.MAKE_EBOOK_WEBHOOK;

    let airtableCreated = false;

    // 1. ÉCRITURE DANS AIRTABLE (si les variables sont présentes)
    if (airtableToken && baseId) {
      try {
        const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
        
        // Structure compatible avec vos champs exacts
        // Note : Ebook_Tichri est un champ de type Checkbox dans votre base
        const payload = {
          fields: {
            'Prénom': prenomClean,
            'Email': emailClean,
            'Téléphone': telClean,
            'Source': 'ebook_tichri_site',
            'Ebook_Tichri': true
          }
        };

        const atRes = await fetch(airtableUrl, {
          method: 'POST',
          headers: {
            // L'en-tête standard fonctionne directement avec les Personal Access Tokens (pat_...)
            'Authorization': `Bearer ${airtableToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (atRes.ok) {
          airtableCreated = true;
        } else {
          const errBody = await atRes.text();
          console.warn('Avertissement Airtable:', errBody);
        }
      } catch (atErr) {
        console.error('Erreur écriture Airtable:', atErr);
      }
    }

    // 2. TRANSMISSION AU WEBHOOK MAKE (déclencheur de l'email avec PDF attaché)
    let makeTriggered = false;
    if (makeWebhookUrl) {
      try {
        const makeRes = await fetch(makeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prenom: prenomClean,
            email: emailClean,
            telephone: telClean,
            source: 'ebook_tichri_site',
            timestamp: new Date().toISOString()
          })
        });
        if (makeRes.ok) {
          makeTriggered = true;
        }
      } catch (makeErr) {
        console.error('Erreur webhook Make:', makeErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Demande enregistrée avec succès.',
      details: {
        airtable: airtableCreated,
        webhook: makeTriggered
      }
    });

  } catch (globalErr) {
    console.error('Erreur submit-ebook:', globalErr);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors du traitement.'
    });
  }
};
