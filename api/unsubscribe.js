'use strict';
/**
 * GET  /api/unsubscribe?e=<email>&t=<signature>  → page de confirmation
 * POST /api/unsubscribe?e=<email>&t=<signature>  → désinscription effective
 * (la confirmation en 2 temps évite qu'un scanner de liens antispam désinscrive
 *  quelqu'un à son insu en « cliquant » le lien dans l'email)
 */
const core = require('./_lib/core');

const page = (title, body) => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${title} · Chalom Bayit Le LAB</title>
<style>
 body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0C10;color:#F0EDE6;font-family:Inter,system-ui,sans-serif;padding:24px}
 .c{max-width:440px;text-align:center}
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

  if (!email || !core.verifyEmail(email, token)) {
    return res.status(400).send(page('Lien invalide',
      '<h1>Lien invalide</h1><p>Ce lien de désinscription n\'est pas valide. Écrivez-moi à malka@chalombayitlelab.com et je vous retire de la liste.</p>'));
  }

  if (req.method === 'POST') {
    try {
      const e = core.fEsc(email);
      const formula = `OR(LOWER({Email_contact})="${e}", LOWER({Email_Femme})="${e}", LOWER({Email_Mari})="${e}")`;
      const json = await core.at(`${core.atUrl()}?pageSize=10&filterByFormula=${encodeURIComponent(formula)}`);
      const records = (json.records || []).map((r) => ({ id: r.id, fields: { Desinscrit: true } }));
      if (records.length) await core.at(core.atUrl(), { method: 'PATCH', body: JSON.stringify({ records }) });
    } catch (err) {
      console.error('[unsubscribe]', err.message);
      return res.status(500).send(page('Erreur',
        '<h1>Oups</h1><p>Une erreur est survenue. Écrivez-moi à malka@chalombayitlelab.com et je vous retire de la liste immédiatement.</p>'));
    }
    return res.status(200).send(page('Désinscription confirmée',
      '<h1>C\'est fait</h1><p>Vous ne recevrez plus d\'emails de ma part. Je vous souhaite le meilleur pour votre couple.</p><a class="g" href="https://coach.chalombayitlelab.com">Retour au site</a>'));
  }

  return res.status(200).send(page('Se désinscrire',
    `<h1>Se désinscrire ?</h1><p>Confirmez-vous ne plus vouloir recevoir d'emails à l'adresse <strong>${esc(email)}</strong> ?</p>
     <form method="POST" action="?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}"><button type="submit">Confirmer ma désinscription</button></form>
     <p style="margin-top:20px"><a class="g" href="https://coach.chalombayitlelab.com">Non, je reste</a></p>`));
};
