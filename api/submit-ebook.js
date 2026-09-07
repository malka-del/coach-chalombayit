<<<<
        // Si la lecture des métadonnées n'est pas disponible, on applique les champs standards
        if (availableFields.size === 0) {
          ['mail_contact', 'prenom_contact', 'tel_contact', 'Email', 'Prénom', 'Téléphone', 'Ebook_Tichri', 'Source']
            .forEach(f => availableFields.add(f));
        }

        // B. Construction de la formule de recherche multi-champs pour dédoublonner
=======
        // Si la lecture des métadonnées n'est pas disponible, on applique les champs standards
        if (availableFields.size === 0) {
          [
            'mail_contact', 'prenom_contact', 'tel_contact', 
            'Email', 'Prénom', 'Téléphone', 
            'Ebook_Tichri', 'ebook_tichri', 'Ebook Tichri', 'Source'
          ].forEach(f => availableFields.add(f));
        }

        // Fonction d'aide insensible à la casse et aux séparateurs (_ ou espace)
        const getMatchingField = (candidates) => {
          for (const cand of candidates) {
            const normCand = cand.replace(/[\s_-]/g, '').toLowerCase();
            for (const f of availableFields) {
              if (f.replace(/[\s_-]/g, '').toLowerCase() === normCand) return f;
            }
          }
          return null;
        };

        // B. Construction de la formule de recherche multi-champs pour dédoublonner
>>>>
====
        // C. Préparation des données à enregistrer
        // On cible prioritairement prenom_contact, mail_contact, tel_contact
        const fieldsPayload = {};

        const targetPrenom = getMatchingField(['prenom_contact', 'Prénom', 'prenom']);
        if (targetPrenom) fieldsPayload[targetPrenom] = prenomClean;

        const targetMail = getMatchingField(['mail_contact', 'Email', 'mail', 'email']);
        if (targetMail) fieldsPayload[targetMail] = emailClean;

        if (telClean) {
          const targetTel = getMatchingField(['tel_contact', 'Téléphone', 'telephone', 'tel']);
          if (targetTel) fieldsPayload[targetTel] = telClean;
        }

        // Détection intelligente du champ Ebook Tichri (quelle que soit la casse ou les tirets)
        const targetEbook = getMatchingField(['ebook_tichri', 'Ebook_Tichri', 'Ebook Tichri', 'ebooktichri']);
        if (targetEbook) {
          fieldsPayload[targetEbook] = true;
        } else {
          // Fallback direct
          fieldsPayload['ebook_tichri'] = true;
        }

        const targetSource = getMatchingField(['Source', 'source']);
        if (targetSource) {
          fieldsPayload[targetSource] = 'ebook_tichri_site';
        }

        // D. Écriture (PATCH si existant, POST si nouveau) avec typecast: true
>>>>
<<<<
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
=======
          const updateUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${existingRecord.id}`;
          const updateRes = await fetch(updateUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields: fieldsPayload, typecast: true })
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
            body: JSON.stringify({ fields: fieldsPayload, typecast: true })
          });
>>>>
```

### Pour appliquer le correctif :
1. Dans votre fichier GitHub `api/submit-ebook.js`, collez cette version mise à jour et validez le commit.
2. Dans Make, ouvrez le module **Google Drive (Download a File)**, videz l'option de conversion/export, et sélectionnez votre PDF depuis la liste.
