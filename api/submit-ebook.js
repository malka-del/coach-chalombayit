/* ========================================================================= */
/* VERCEL SERVERLESS FUNCTION : /api/submit-ebook.js                         */
/* Recherche multi-emails (mail_contact, mail_femme, mail_mari) + Création   */
/* ========================================================================= */

module.exports = async function handler(req, res) {
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
    return res.status(405).json({ success: false, message: 'Méthode non autorisée' });
  }

  try {
    const { prenom, email, telephone } = req.body || {};

    if (!prenom || !email) {
      return res.status(400).json({ success: false, message: 'Prénom et email requis.' });
    }

    const emailClean = String(email).trim().toLowerCase();
    const prenomClean = String(prenom).trim();
    const telClean = telephone ? String(telephone).trim() : '';

    const airtableToken = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_TABLE_NAME || 'Couples et CRM';
    const makeWebhookUrl = process.env.MAKE_EBOOK_WEBHOOK;

    let airtableDone = false;

    // 1. RECHERCHE ET ÉCRITURE DANS AIRTABLE
    if (airtableToken && baseId) {
      try {
        let existingRecordId = null;

        // Formule de recherche multi-champs (mail_contact, mail_femme, mail_mari)
        const multiSearchFormula = `OR({mail_contact}='${emailClean}', {mail_femme}='${emailClean}', {mail_mari}='${emailClean}')`;
        const multiSearchUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(multiSearchFormula)}`;
        
        let searchRes = await fetch(multiSearchUrl, {
          headers: { 'Authorization': `Bearer ${airtableToken}` }
        });

        // Fallback si l'un des champs (ex: mail_femme) n'existe pas dans la base
        if (!searchRes.ok) {
          const fallbackFormula = `{mail_contact}='${emailClean}'`;
          const fallbackUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(fallbackFormula)}`;
          searchRes = await fetch(fallbackUrl, {
            headers: { 'Authorization': `Bearer ${airtableToken}` }
          });
        }

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.records && searchData.records.length > 0) {
            existingRecordId = searchData.records[0].id;
          }
        }

        const fieldsPayload = {
          'prenom_contact': prenomClean,
          'mail_contact': emailClean,
          'tel_contact': telClean,
          'ebook_tichri': true,
          'Source': 'ebook_tichri_site'
        };

        if (existingRecordId) {
          // Si le contact existe (dans n'importe quel champ mail), on met à jour sa fiche
          const patchRes = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${existingRecordId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${airtableToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: fieldsPayload, typecast: true })
          });
          if (patchRes.ok) airtableDone = true;
        } else {
          // Si le contact n'existe nulle part, ON LE CRÉE
          const createRes = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${airtableToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: fieldsPayload, typecast: true })
          });
          if (createRes.ok) airtableDone = true;
        }
      } catch (atErr) {
        console.error('Erreur Airtable:', atErr);
      }
    }

    // 2. TRANSMISSION AU WEBHOOK MAKE (Envoi de l'email)
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
        if (makeRes.ok) makeTriggered = true;
      } catch (makeErr) {
        console.error('Erreur Make:', makeErr);
      }
    }

    // Renvoyer le succès si Make ou Airtable a fonctionné
    if (makeTriggered || airtableDone) {
      return res.status(200).json({ success: true, message: 'Inscription réussie.' });
    } else {
      return res.status(500).json({ success: false, message: 'Erreur de traitement de la demande.' });
    }

  } catch (globalErr) {
    console.error('Erreur globale:', globalErr);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};
