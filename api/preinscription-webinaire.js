'use strict';
/**
 * POST /api/preinscription-webinaire
 * Inscription au webinaire du 1er décembre (lancement du programme de coaching hybride).
 * Corps : { prenom, email, defi?, attentes?, consent: true, website: '' }
 * - enregistre (ou met à jour) la fiche Airtable : Webinaire_1dec (case à cocher) + Webinaire_date (date) ;
 * - défi et attentes (facultatifs) : toujours dans l'alerte mail ; enregistrés dans Webinaire_defi / Webinaire_attentes si ces champs existent ;
 * - envoie un mail de confirmation à la personne et une alerte à Alison (via le webhook Make habituel).
 * Ne dépend PAS de la fenêtre de candidature : ouvert dès maintenant, jusqu'au début du webinaire (voir core.webinaireOpen).
 */
const core = require('./_lib/core');

const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async function handler(req, res) {
  core.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'Requête invalide.' });
  if (body.website) return res.status(200).json({ ok: true }); // robot

  if (!core.webinaireOpen()) return res.status(200).json({ ok: false, closed: true, error: 'Les inscriptions sont terminées.' });

  const prenom = core.clean(body.prenom, 60);
  const email = core.clean(body.email, 254).toLowerCase();
  const defi = core.clean(body.defi, 800);
  const attentes = core.clean(body.attentes, 800);
  const errors = {};
  if (!prenom) errors.prenom = 'Merci de renseigner votre prénom.';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "L'adresse e-mail ne semble pas valide.";
  if (body.consent !== true) errors.consent = 'Merci de cocher la case pour valider votre inscription.';
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  const today = core.parisDate();
  let saved = false, already = false, saveError = '', answersError = '', recId = '';
  try {
    const rec = await core.findByEmail(email);
    if (rec) {
      const f = rec.fields || {};
      already = !!f.Webinaire_1dec;
      const patch = { Webinaire_1dec: true, Webinaire_date: f.Webinaire_date || today };
      if (!f['Prenom_contact'] && !f['Prénom_contact']) patch['Prenom_contact'] = prenom;
      if (!f.Email_contact && !f.Email_Femme && !f.Email_Mari) patch.Email_contact = email;
      await core.atWrite('PATCH', core.atUrl(`/${rec.id}`), patch);
      recId = rec.id;
    } else {
      const created = await core.atWrite('POST', core.atUrl(), {
        'Prenom_contact': prenom, Email_contact: email, Source: 'Webinaire', Statut_Client: 'Prospect',
        Date_premier_contact: today, Webinaire_1dec: true, Webinaire_date: today,
      });
      recId = (created && created.id) || '';
    }
    saved = true;
  } catch (e) { saveError = String((e && e.message) || e).slice(0, 300); console.error('[preinscription-webinaire] Airtable (champs Webinaire_1dec / Webinaire_date manquants ?):', saveError); }

  // Réponses facultatives : écriture séparée, pour qu'un champ manquant ne bloque jamais l’inscription.
  const answers = {};
  if (defi) answers.Webinaire_defi = defi;
  if (attentes) answers.Webinaire_attentes = attentes;
  if (saved && recId && Object.keys(answers).length) {
    try { await core.atWrite('PATCH', core.atUrl(`/${recId}`), answers); }
    catch (e) { answersError = String((e && e.message) || e).slice(0, 300); console.error('[preinscription-webinaire] Airtable (champs Webinaire_defi / Webinaire_attentes manquants ?):', answersError); }
  }
  const bloc = (titre, t) => (t ? `<p><strong>${titre} :</strong><br>${esc(t)}</p>` : '');

  // Alerte pour Alison : toujours envoyée, même si Airtable a échoué (rien n'est perdu).
  try {
    await core.sendToMake({
      email: core.candNotifEmail(),
      subject: `Inscription webinaire · ${prenom.replace(/[<>\r\n]/g, '')}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1E293B;line-height:1.6"><h2 style="margin:0 0 8px">Nouvelle inscription au webinaire du 1er décembre</h2><p><strong>${esc(prenom)}</strong> · <a href="mailto:${esc(email)}">${esc(email)}</a></p><p style="color:#64748B;font-size:13px">${already ? 'Déjà inscrit(e) (nouvelle demande). ' : ''}</p>${saved ? '' : `<p style="color:#B91C1C;font-size:13px"><strong>ATTENTION : non enregistré dans Airtable.</strong> Garde ce mail. Erreur : ${esc(saveError)}</p>`}${bloc('Principal défi', defi)}${bloc('Attentes', attentes)}${answersError ? `<p style="color:#B91C1C;font-size:13px">Réponses non enregistrées dans Airtable : garde ce mail. Erreur : ${esc(answersError)}</p>` : ''}</div>`,
      etape: 'NOTIF_WEB', profil: 'web', profil_label: 'Notification inscription webinaire', score: '', prenom: 'Alison', nom: '', telephone: '', unsub_url: '',
    });
  } catch (e) { console.error('[preinscription-webinaire] notif:', e && e.message); }

  let emailSent = false;
  try {
    await core.sendToMake(core.makePayload({ etape: 'WEB_OK', profile: { code: 'web', label: 'Webinaire' }, score: '', prenom, nom: '', email, telephone: '' }));
    emailSent = true;
  } catch (e) { console.error('[preinscription-webinaire] Make:', e && e.message); }

  return res.status(200).json({ ok: true, saved, emailSent });
};
