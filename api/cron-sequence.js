'use strict';
/**
 * GET /api/cron-sequence  (appelé chaque jour par Vercel Cron, voir vercel.json)
 * Envoie les mails J+3 et J+10 aux prospects du quiz, et le rappel de fin d'essai (J+6) du Coach IA, via le webhook Make.
 *
 * Règles :
 *  - seulement les prospects avec Date_quiz renseignée, Statut_Client = « Prospect »,
 *    non désinscrits, et dont le mail de l'étape n'a pas déjà été envoyé ;
 *  - fenêtre d'envoi : J3 entre 3 et 6 jours, J10 entre 10 et 14 jours (rattrapage si un cron saute) ;
 *  - la case Sequence_J3 / Sequence_J10 est cochée AVANT l'envoi (pas de doublon) et décochée si l'envoi échoue ;
 *  - passer le statut du contact à autre chose que « Prospect » (séance planifiée, client…) arrête la séquence.
 *
 * Test à blanc : /api/cron-sequence?dry=1 (liste ce qui serait envoyé, n'envoie rien).
 */
const core = require('./_lib/core');

const STEPS = [
  { etape: 'J3',  flag: 'Sequence_J3',  min: 3,  max: 6 },
  { etape: 'J10', flag: 'Sequence_J10', min: 10, max: 14 },
  // Fin d'essai du Coach IA (WhatsApp) : « demain votre essai se termine », 6 à 7 jours après le début de l'essai.
  { etape: 'J6', flag: 'Rappel_essai_envoye', min: 6, max: 7, trial: true },
];
const MAX_PER_RUN = 100;

function pick(f, keys) {
  for (const k of keys) if (f[k] && String(f[k]).trim()) return String(f[k]).trim();
  return '';
}

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'Non autorisé' });
  }
  const dry = req.query && (req.query.dry === '1' || req.query.dry === 'true');
  const summary = { dry: !!dry, sent: [], skipped: [], failed: [] };
  let budget = MAX_PER_RUN;

  for (const step of STEPS) {
    const days = step.trial ? "DATETIME_DIFF(TODAY(), {Date_debut_essai}, 'days')" : "DATETIME_DIFF(TODAY(), {Date_quiz}, 'days')";
    const formula = step.trial
      ? `AND({Date_debut_essai}, {Statut_Coach_IA}='MODE_SOUTIEN', {Email_contact}, NOT({Desinscrit}), NOT({${step.flag}}), ${days}>=${step.min}, ${days}<=${step.max})`
      : `AND({Date_quiz}, {Profil_Quiz}, {Statut_Client}='Prospect', NOT({Desinscrit}), NOT({${step.flag}}), ${days}>=${step.min}, ${days}<=${step.max})`;
    let records = [];
    try {
      const json = await core.at(`${core.atUrl()}?pageSize=100&filterByFormula=${encodeURIComponent(formula)}`);
      records = json.records || [];
    } catch (e) {
      console.error(`[cron ${step.etape}] Airtable:`, e.message);
      summary.failed.push({ etape: step.etape, error: e.message });
      continue;
    }

    for (const rec of records) {
      if (budget <= 0) break;
      const f = rec.fields || {};
      const email = pick(f, ['Email_contact', 'Email_Femme', 'Email_Mari']).toLowerCase();
      const prenom = pick(f, ['Prenom_contact', 'Prénom_contact', 'Prenom_Femme', 'Prenom_Mari']) || 'Bonjour';
      const profile = step.trial ? { code: 'essai', label: 'Essai Coach IA' } : core.profileFromAirtable(f.Profil_Quiz);
      const score = Number(f.Score_quiz);
      if (!email || !profile) { summary.skipped.push({ id: rec.id, etape: step.etape, why: 'email ou profil manquant' }); continue; }
      if (dry) { summary.sent.push({ etape: step.etape, email, profil: profile.code }); continue; }

      budget -= 1;
      try {
        await core.at(core.atUrl(`/${rec.id}`), { method: 'PATCH', body: JSON.stringify({ fields: { [step.flag]: true } }) });
      } catch (e) {
        summary.failed.push({ id: rec.id, etape: step.etape, error: 'marquage: ' + e.message });
        continue; // sans marquage on n'envoie pas (évite les doublons)
      }
      try {
        await core.sendToMake(core.makePayload({
          etape: step.etape, profile, score: Number.isFinite(score) ? score : '',
          prenom, nom: f.Nom_Famille || '', email, telephone: f.Telephone_contact || '',
        }));
        summary.sent.push({ etape: step.etape, email, profil: profile.code });
      } catch (e) {
        summary.failed.push({ id: rec.id, etape: step.etape, error: 'envoi: ' + e.message });
        try { await core.at(core.atUrl(`/${rec.id}`), { method: 'PATCH', body: JSON.stringify({ fields: { [step.flag]: false } }) }); } catch (e2) { /* sera réessayé manuellement */ }
      }
    }
  }

  console.log('[cron-sequence]', JSON.stringify({ sent: summary.sent.length, skipped: summary.skipped.length, failed: summary.failed.length }));
  return res.status(200).json({ ok: true, ...summary });
};
