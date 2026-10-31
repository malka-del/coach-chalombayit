'use strict';
/**
 * POST /api/submit-quiz
 * Reçoit les réponses du quiz du site, calcule le score CÔTÉ SERVEUR,
 * enregistre le prospect dans Airtable et déclenche le mail de résultat via Make.
 */
const core = require('./_lib/core');

module.exports = async function handler(req, res) {
  core.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }

  const v = core.validate(body);
  if (!v.ok) return res.status(400).json({ ok: false, errors: v.errors });
  const d = v.data;

  // Anti-robots : le champ « website » est caché, un humain ne le remplit jamais.
  if (d.honeypot) return res.status(200).json({ ok: true, emailSent: true });

  const { total, pillars } = core.scoreAnswers(d.answers);
  const profile = core.profileFor(total);
  const result = { total, pillars, profile };

  // 1) Airtable d'abord : il compte les envois par adresse (limite anti-abus, 3 par défaut).
  let crm = null, crmError = null;
  try { crm = await core.upsertProspect(d, result); } catch (e) { crmError = e; console.error('[submit-quiz] Airtable:', e && e.message); }
  const limited = !!(crm && crm.count > core.maxSends());

  // 2) Mail via Make (sauf si la limite est atteinte pour cette adresse).
  let emailSent = false;
  if (!limited) {
    try {
      await core.sendToMake(core.makePayload({
        etape: 'J0', profile, score: total,
        prenom: d.prenom, nom: d.nom, email: d.email, telephone: d.telephone,
      }));
      emailSent = true;
    } catch (e) { console.error('[submit-quiz] Make:', e && e.message); }
  }

  return res.status(200).json({
    ok: true,
    score: total,
    profil: profile.code,
    profilLabel: profile.label,
    pillars,
    emailSent,
    limited,
    ref: crm && crm.id ? core.makeRef(crm.id) : '',
    bookUrl: core.bookUrl(),
  });
};
