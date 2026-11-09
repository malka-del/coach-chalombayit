'use strict';
/**
 * GET /api/cron-digest  (déclenché chaque soir par Vercel Cron, ou à la main avec ?dry=1)
 * Résumé quotidien pour Alison : nouveaux quiz, préinscriptions webinaire, essais Coach IA démarrés,
 * candidatures, et nombre de conversations Coach IA actives aujourd'hui.
 * Confidentialité : seuls les prénoms et des compteurs sont lus/écrits ; ni coordonnées ni texte des conversations.
 * Le mail n'est envoyé qu'à Alison (CANDIDATURE_NOTIF_EMAIL), uniquement s'il s'est passé quelque chose.
 */
const core = require('./_lib/core');

const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today0 = (field) => `DATETIME_DIFF(TODAY(), {${field}}, 'days')=0`;

async function names(formula, extra) {
  const fields = ['Prenom_contact', 'Prénom_contact', ...(extra || [])].map((f) => `fields%5B%5D=${encodeURIComponent(f)}`).join('&');
  let json;
  try { json = await core.at(`${core.atUrl()}?pageSize=50&${fields}&filterByFormula=${encodeURIComponent(formula)}`); }
  catch (e) {
    // champ « Prénom_contact » absent : on retente sans lui
    json = await core.at(`${core.atUrl()}?pageSize=50&fields%5B%5D=Prenom_contact&filterByFormula=${encodeURIComponent(formula)}`);
  }
  return (json.records || []).map((r) => {
    const f = r.fields || {};
    return { prenom: String(f.Prenom_contact || f['Prénom_contact'] || 'Anonyme').slice(0, 40), f };
  });
}

async function activeConversations() {
  const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID || 'appoelLZhjYcrttEa'}/tblB1AFnEiYW9xonr`;
  const formula = `AND(DATETIME_DIFF(TODAY(), {Timestamp}, 'days')=0, {Qui_a_parle}!='Coach_IA')`;
  const ids = new Set();
  let offset = '';
  for (let i = 0; i < 5; i++) {
    const json = await core.at(`${url}?pageSize=100&fields%5B%5D=Lien%20couple&filterByFormula=${encodeURIComponent(formula)}${offset ? `&offset=${offset}` : ''}`);
    for (const r of json.records || []) for (const id of ((r.fields || {})['Lien couple'] || [])) ids.add(id);
    offset = json.offset || '';
    if (!offset) break;
  }
  return ids.size;
}

const list = (arr) => arr.map((a) => `<li>${esc(a.prenom)}${a.note ? ` <span style="color:#64748B">· ${esc(a.note)}</span>` : ''}</li>`).join('');
const block = (title, arr) => (arr.length ? `<h3 style="margin:18px 0 6px;font-size:15px">${esc(title)} (${arr.length})</h3><ul style="margin:0;padding-left:20px">${list(arr)}</ul>` : '');

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ ok: false, error: 'Non autorisé' });
  const dry = req.query && (req.query.dry === '1' || req.query.dry === 'true');

  const out = { quiz: [], web: [], essai: [], cand: [], conv: 0, errors: [] };
  const run = async (key, fn) => { try { out[key] = await fn(); } catch (e) { out.errors.push(`${key}: ${String((e && e.message) || e).slice(0, 120)}`); } };

  await run('quiz', async () => (await names(`AND({Date_quiz}, ${today0('Date_quiz')})`, ['Profil_Quiz'])).map((r) => ({ prenom: r.prenom, note: r.f.Profil_Quiz || '' })));
  await run('web', async () => (await names(`AND({Webinaire_1dec}, ${today0('Webinaire_date')})`)).map((r) => ({ prenom: r.prenom })));
  await run('essai', async () => (await names(`AND({Date_debut_essai}, ${today0('Date_debut_essai')})`)).map((r) => ({ prenom: r.prenom })));
  await run('cand', async () => (await names(`AND({Candidature_date}, ${today0('Candidature_date')})`)).map((r) => ({ prenom: r.prenom })));
  await run('conv', activeConversations);

  const activity = out.quiz.length + out.web.length + out.essai.length + out.cand.length + out.conv;
  const summary = { dry: !!dry, quiz: out.quiz.length, web: out.web.length, essai: out.essai.length, cand: out.cand.length, conversations: out.conv, errors: out.errors, sent: false };
  if (!activity && !out.errors.length) return res.status(200).json({ ok: true, ...summary, note: 'rien à signaler, aucun mail' });

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1E293B;line-height:1.6"><h2 style="margin:0 0 4px">Résumé du jour</h2><p style="margin:0;color:#64748B;font-size:13px">${esc(core.parisDate())}</p>`
    + block('Quiz terminés', out.quiz) + block('Préinscriptions au webinaire', out.web) + block('Essais Coach IA démarrés', out.essai) + block('Candidatures', out.cand)
    + (out.conv ? `<h3 style="margin:18px 0 6px;font-size:15px">Conversations Coach IA actives aujourd'hui</h3><p style="margin:0">${out.conv} personne(s) ont écrit au coach.</p>` : '')
    + (out.errors.length ? `<p style="color:#B91C1C;font-size:13px;margin-top:18px">Une partie du résumé n'a pas pu être lue : ${esc(out.errors.join(' · '))}</p>` : '')
    + `<p style="color:#64748B;font-size:12px;margin-top:22px">Prénoms et compteurs uniquement. Les coordonnées et les conversations restent dans Airtable.</p></div>`;

  if (dry) return res.status(200).json({ ok: true, ...summary, note: 'dry : mail non envoyé' });
  try {
    await core.sendToMake({ email: core.candNotifEmail(), subject: `Résumé du jour · ${out.quiz.length} quiz · ${out.web.length} webinaire · ${out.essai.length} essai(s) IA`, html, etape: 'NOTIF_DIGEST', profil: 'digest', profil_label: 'Résumé quotidien', score: '', prenom: 'Alison', nom: '', telephone: '', unsub_url: '' });
    summary.sent = true;
  } catch (e) { summary.errors.push(`mail: ${String((e && e.message) || e).slice(0, 120)}`); }
  return res.status(200).json({ ok: true, ...summary });
};
