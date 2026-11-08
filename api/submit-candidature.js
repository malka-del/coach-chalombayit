'use strict';
/**
 * POST /api/submit-candidature
 * Candidature « couples fondateurs » déposée APRÈS le quiz (depuis la page de résultat).
 * Corps : { email, candidature: { active, conjoint, duree, dispo, attentes, engagement, consent } }
 * Le visiteur doit déjà avoir une fiche (quiz fait). Fenêtre d'ouverture contrôlée côté serveur.
 */
const core = require('./_lib/core');

module.exports = async function handler(req, res) {
  core.setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'Requête invalide.' });
  if (body.website) return res.status(200).json({ ok: true, statut: 'A_appeler' }); // robot

  if (!core.candOpen()) return res.status(200).json({ ok: false, closed: true, error: 'Les candidatures sont terminées.' });

  const email = core.clean(body.email, 254).toLowerCase();
  const cand = core.cleanCandidature(body.candidature);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !cand) {
    return res.status(400).json({ ok: false, error: 'Candidature incomplète.' });
  }

  let rec;
  try { rec = await core.findByEmail(email); } catch (e) { console.error('[submit-candidature] Airtable:', e && e.message); }
  if (!rec) return res.status(404).json({ ok: false, error: 'Je ne retrouve pas votre quiz. Refaites le quiz pour candidater.' });

  const f = rec.fields || {};
  const profile = core.profileFromAirtable(f.Profil_Quiz) || core.PROFILES.agile;
  const prenom = f['Prenom_contact'] || f['Prénom_contact'] || '';

  // Limite anti-abus : pas plus de 3 candidatures déposées par fiche (réponses conservées dans Reponses_quiz)
  let details = {};
  try { details = JSON.parse(f.Reponses_quiz || '{}') || {}; } catch (e) { details = {}; }
  const nb = (Number(details.candidature_depots) || 0) + 1;
  if (nb > 3) return res.status(429).json({ ok: false, error: 'Merci d’écrire à Alison via le formulaire de contact du site.' });
  details.candidature = { ...cand, consent_candidature_at: new Date().toISOString() };
  details.candidature_depots = nb;

  const saved = await core.saveCandidature(rec.id, cand, JSON.stringify(details));

  let emailSent = false;
  try {
    await core.sendToMake(core.makePayload({
      etape: 'CAND_OK', profile: { code: 'cand', label: 'Candidature' }, score: '',
      prenom, nom: f.Nom_Famille || '', email, telephone: f.Telephone_contact || '', cand,
    }));
    emailSent = true;
  } catch (e) { console.error('[submit-candidature] Make:', e && e.message); }
  try {
    await core.sendToMake(core.notifPayload({ prenom, nom: f.Nom_Famille || '', email, cand, score: Number(f.Score_quiz), profilLabel: profile.label, late: true }));
  } catch (e) { console.error('[submit-candidature] notif:', e && e.message); }

  return res.status(200).json({ ok: true, statut: core.candStatut(cand), saved, emailSent, rdvUrl: core.rdvUrl() });
};
