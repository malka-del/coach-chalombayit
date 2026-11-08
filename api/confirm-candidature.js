'use strict';
/**
 * GET  /api/confirm-candidature?e=<email>&t=<signature>  → page « confirmer notre candidature »
 * POST /api/confirm-candidature?e=<email>&t=<signature>  → confirmation effective (statut A_confirmer → A_appeler)
 * Confirmation en 2 temps (comme la désinscription) pour qu'un scanner de liens n'active rien tout seul.
 */
const core = require('./_lib/core');

const page = (title, body) => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${title} · Chalom Bayit Le LAB</title>
<style>
 body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0C10;color:#F0EDE6;font-family:Inter,system-ui,sans-serif;padding:24px}
 .c{max-width:460px;text-align:center}
 h1{font-family:Georgia,serif;color:#E2C266;font-weight:400;font-size:1.7rem;margin:0 0 12px}
 p{color:#8A8FA8;line-height:1.6;margin:0 0 20px}
 button,a.b{display:inline-block;background:#E845A8;color:#fff;border:0;border-radius:100px;padding:14px 28px;font:700 .95rem Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none}
 a.g{color:#8A8FA8;font-size:.85rem}
</style></head><body><div class="c">${body}</div></body></html>`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const email = String((req.query && req.query.e) || '').trim().toLowerCase();
  const token = String((req.query && req.query.t) || '');
  if (!email || !core.verifyCand(email, token)) {
    return res.status(400).send(page('Lien invalide', '<h1>Lien invalide</h1><p>Ce lien n\'est pas valide. Écrivez-moi à malka@chalombayitlelab.com et je confirme votre candidature.</p>'));
  }
  if (!core.candOpen()) {
    return res.status(200).send(page('Candidatures terminées', '<h1>Les candidatures sont terminées</h1><p>La période de candidature est close. Écrivez-moi à malka@chalombayitlelab.com si vous avez une question.</p><a class="g" href="https://coach.chalombayitlelab.com">Retour au site</a>'));
  }

  if (req.method === 'POST') {
    try {
      const rec = await core.findByEmail(email);
      if (!rec) throw new Error('fiche introuvable');
      const f = rec.fields || {};
      let cand = null;
      try { cand = (JSON.parse(f.Reponses_quiz || '{}') || {}).candidature || null; } catch (e) { /* ignore */ }
      if (!f.Candidature_fondateur) throw new Error('pas de candidature');
      await core.atWrite('PATCH', core.atUrl(`/${rec.id}`), { Candidature_statut: 'A_appeler', Candidature_conjoint: 'oui' });
      const prenom = f['Prenom_contact'] || f['Prénom_contact'] || '';
      const c2 = { ...(cand || { duree: '', dispo: 'a_discuter', attentes: '' }), conjoint: 'oui' };
      try {
        await core.sendToMake(core.makePayload({
          etape: 'CAND_OK', profile: { code: 'cand', label: 'Candidature' }, score: '',
          prenom, nom: f.Nom_Famille || '', email, telephone: f.Telephone_contact || '', cand: c2,
        }));
      } catch (e) { console.error('[confirm-candidature] mail:', e && e.message); }
      try {
        await core.sendToMake(core.notifPayload({ prenom, nom: f.Nom_Famille || '', email, cand: c2, score: Number(f.Score_quiz), confirmed: true }));
      } catch (e) { console.error('[confirm-candidature] notif:', e && e.message); }
    } catch (err) {
      console.error('[confirm-candidature]', err.message);
      return res.status(500).send(page('Erreur', '<h1>Oups</h1><p>Une erreur est survenue. Écrivez-moi à malka@chalombayitlelab.com et je confirme votre candidature à la main.</p>'));
    }
    return res.status(200).send(page('Candidature confirmée', '<h1>Candidature confirmée ✨</h1><p>Merci ! Votre candidature est confirmée. Je l\'étudie, et si elle est présélectionnée je vous écris pour vous proposer un appel de 15 à 30 minutes.</p><a class="g" href="https://coach.chalombayitlelab.com">Retour au site</a>'));
  }

  return res.status(200).send(page('Confirmer notre candidature',
    `<h1>Confirmer votre candidature</h1><p>Vous et votre conjoint(e) en avez parlé et souhaitez candidater au programme des couples fondateurs (adresse : <strong>${esc(email)}</strong>) ?</p>
     <form method="POST" action="?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}"><button type="submit">Oui, nous confirmons</button></form>
     <p style="margin-top:20px"><a class="g" href="https://coach.chalombayitlelab.com">Pas maintenant</a></p>`));
};
