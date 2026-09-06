/* ========================================================================= */
/* VERCEL SERVERLESS FUNCTION : /api/submit-ebook.js                         */
/* Compatible avec les nouveaux jetons Airtable Personal Access Tokens (pat_)*/
/* Dédoublonnage multi-champs & écriture dans prenom/mail/tel_contact        */
/* ========================================================================= */

module.exports = async function handler(req, res) {
  // Gestion CORS pour les requêtes pré-vol OPTIONS et autorisations
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
    const telClean = telephone ? String(telephone).trim().replace(/\s+/g, '') : '';

    const airtableToken = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_TABLE_NAME || 'Couples et CRM';
    const makeWebhookUrl = process.env.MAKE_EBOOK_WEBHOOK;

    let airtableStatus = 'skipped';
    let airtableRecordId = null;

    // 1. GESTION AIRTABLE (RECHERCHE MULTI-CHAMPS + CRÉATION OU MISE À JOUR)
    if (airtableToken && baseId) {
      const headers = {
        'Authorization': `Bearer ${airtableToken}`,
        'Content-Type': 'application/json'
      };

      try {
        // A. Détection des champs réels existants dans la table pour éviter toute erreur 422
        let availableFields = new Set();
        try {
          const metaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers });
          if (metaRes.ok) {
            const metaData = await metaRes.json();
            const currentTable = metaData.tables.find(t => t.name === tableName || t.id === tableName);
            if (currentTable) {
              currentTable.fields.forEach(f => availableFields.add(f.name));
            }
          }
        } catch (metaErr) {
          console.warn('Impossible de lire les métadonnées de la table, fallback par défaut:', metaErr.message);
        }

        // Si la lecture des métadonnées n'est pas disponible, on applique les champs standards
        if (availableFields.size === 0) {
          ['mail_contact', 'prenom_contact', 'tel_contact', 'Email', 'Prénom', 'Téléphone', 'Ebook_Tichri', 'Source']
            .forEach(f => availableFields.add(f));
        }

        // B. Construction de la formule de recherche multi-champs pour dédoublonner
        // Recherche dans mail_contact ET dans les autres champs d'emails possibles (femme, mari, etc.)
        const emailSearchCandidates = [
          'mail_contact', 'Email', 'email', 'Mail', 'mail',
          'email_femme', 'mail_femme', 'email_mari', 'mail_mari',
          'email_conjoint', 'mail_conjoint', 'Email 1', 'Email 2'
        ];

        const validEmailFields = emailSearchCandidates.filter(f => availableFields.has(f));
        const orConditions = validEmailFields.map(f => `LOWER({${f}}) = '${emailClean}'`);

        // Recherche optionnelle par téléphone si fourni
        if (telClean.length >= 6) {
          const telSearchCandidates = [
            'tel_contact', 'Téléphone', 'telephone', 'Tel', 'tel',
            'tel_femme', 'tel_mari', 'telephone_femme', 'telephone_mari',
            'tel_conjoint', 'Tel 1', 'Tel 2'
          ];
          const validTelFields = telSearchCandidates.filter(f => availableFields.has(f));
          validTelFields.forEach(f => {
            orConditions.push(`FIND('${telClean}', SUBSTITUTE(SUBSTITUTE({${f}}, ' ', ''), '-', '')) > 0`);
          });
        }

        let existingRecord = null;
        if (orConditions.length > 0) {
          const formula = orConditions.length > 1 ? `OR(${orConditions.join(',')})` : orConditions[0];
          const searchUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
          
          const searchRes = await fetch(searchUrl, { method: 'GET', headers });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.records && searchData.records.length > 0) {
              existingRecord = searchData.records[0];
            }
          }
        }

        // C. Préparation des données à enregistrer
        // On cible prioritairement prenom_contact, mail_contact, tel_contact
        const fieldsPayload = {};

        if (availableFields.has('prenom_contact')) {
          fieldsPayload['prenom_contact'] = prenomClean;
        } else if (availableFields.has('Prénom')) {
          fieldsPayload['Prénom'] = prenomClean;
        }

        if (availableFields.has('mail_contact')) {
          fieldsPayload['mail_contact'] = emailClean;
        } else if (availableFields.has('Email')) {
          fieldsPayload['Email'] = emailClean;
        }

        if (telClean && availableFields.has('tel_contact')) {
          fieldsPayload['tel_contact'] = telClean;
        } else if (telClean && availableFields.has('Téléphone')) {
          fieldsPayload['Téléphone'] = telClean;
        }

        if (availableFields.has('Ebook_Tichri')) {
          fieldsPayload['Ebook_Tichri'] = true;
        }

        if (availableFields.has('Source')) {
          fieldsPayload['Source'] = 'ebook_tichri_site';
        }

        // D. Écriture (PATCH si existant, POST si nouveau)
        if (existingRecord) {
          // Mise à jour de la fiche existante sans créer de doublon
          const updateUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${existingRecord.id}`;
          const updateRes = await fetch(updateUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields: fieldsPayload })
          });
          if (updateRes.ok) {
            airtableStatus = 'updated';
            airtableRecordId = existingRecord.id;
          }
        } else {
          // Création d'une nouvelle fiche contact
          const createUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
          const createRes = await fetch(createUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ fields: fieldsPayload })
          });
          if (createRes.ok) {
            const createdData = await createRes.json();
            airtableStatus = 'created';
            airtableRecordId = createdData.id;
          } else {
            const errText = await createRes.text();
            console.error('Erreur création Airtable:', errText);
          }
        }
      } catch (atErr) {
        console.error('Exception traitement Airtable:', atErr);
      }
    }

    // 2. DÉCLENCHEMENT DU WEBHOOK MAKE (POUR ENVOI DE L'EMAIL AVEC LE PDF)
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
            airtable_status: airtableStatus,
            airtable_record_id: airtableRecordId,
            timestamp: new Date().toISOString()
          })
        });
        if (makeRes.ok) {
          makeTriggered = true;
        }
      } catch (makeErr) {
        console.error('Erreur déclenchement Webhook Make:', makeErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Demande traitée avec succès.',
      details: {
        airtable: airtableStatus,
        recordId: airtableRecordId,
        webhook: makeTriggered
      }
    });

  } catch (globalErr) {
    console.error('Erreur globale submit-ebook:', globalErr);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur lors du traitement.'
    });
  }
};
