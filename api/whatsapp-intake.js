'use strict';
/**
 * POST /api/whatsapp-intake   (appelé par le scénario Make « Notre coach de poche », pas par le navigateur)
 *
 * Reçoit chaque message WhatsApp entrant { from, body, profile_name } et répond :
 *   { handled: true,  reply: "texte" }  -> Make envoie ce texte et s'arrête (accueil, « oui », questions de fiche)
 *   { handled: false }                  -> Make continue vers le Coach IA comme avant
 *
 * Parcours :
 *   numéro inconnu            -> invitation « voulez-vous démarrer votre essai offert ? (répondez OUI) »
 *   « OUI »                   -> fiche créée OU mise à jour (un seul enregistrement par numéro), Statut_Coach_IA = MODE_SOUTIEN,
 *                                Date_debut_essai = aujourd'hui, puis questions : nom -> e-mail -> principal défi
 *   MODE_SOUTIEN en onboarding-> la réponse est rangée dans la fiche ; si le message ne ressemble pas à une réponse
 *                                (long, question…), l'onboarding s'arrête et le Coach IA répond normalement
 *   MODE_BILAN / MODE_VIP     -> rien n'est changé
 * Sécurité : en-tête x-intake-secret = variable Vercel INTAKE_SECRET.
 */
const crypto = require('crypto');
const core = require('./_lib/core');

const SITE = 'https://coach.chalombayitlelab.com';
const T = {
  invite: `Bonjour 🌿 Je suis Notre coach de poche, le coach de couple de Chalom Bayit Le LAB, disponible 24h/24. Votre numéro n'est pas encore enregistré chez moi.\n\nVoulez-vous démarrer votre essai offert de 7 jours ? Répondez simplement OUI.\n\nEn répondant OUI, vous acceptez que nos échanges soient traités selon la politique de confidentialité : ${SITE}/politique-confidentialite. Ces échanges sont confidentiels et supervisés par une coach humaine.\n\nPour en savoir plus : ${SITE}\n\nCeci est un message automatique.`,
  welcome: `Merci, votre essai de 7 jours démarre maintenant ✨\n\nPour que je m'adresse bien à vous : comment dois-je vous appeler ? (prénom et nom, ou écrivez « passer »)`,
  askEmail: (p) => `${p ? 'Ravie de vous connaître ' + p + ' 🌿' : 'Très bien 🌿'}\n\nSi vous le souhaitez, laissez-moi votre e-mail : je vous préviendrai de la fin de votre essai. (Ou écrivez « passer ».)`,
  askDefi: `Merci, c'est noté ✨\n\nDernière question : quel est aujourd'hui le principal défi dans votre couple ? Prenez le temps qu'il vous faut.`,
  error: `Je rencontre un petit souci technique, pouvez-vous réessayer dans quelques minutes ? Merci 🌿`,
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const YES = new Set(['oui', 'ouii', 'ouiii', 'yes', 'ok', 'okay', "d'accord", 'dac', 'daccord', 'je veux bien', 'volontiers', 'avec plaisir', 'oui je veux', 'oui bien sur', 'bien sur', 'oui merci']);
const isYes = (body) => YES.has(norm(body));
const isSkip = (body) => ['passer', 'non', 'non merci', 'plus tard', 'skip', 'pas maintenant'].includes(norm(body));
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '');

function parseName(body) {
  const clean = String(body || '').replace(/[^\p{L}\p{M}' -]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const t = clean.split(' ').filter(Boolean);
  if (!t.length || t.length > 4 || clean.length > 60) return null;
  return { prenom: cap(t[0]), nom: t.slice(1).map(cap).join(' ') };
}

const fq = (s) => core.fEsc(s);
async function findByPhone(phone) {
  const p = fq(phone);
  const formula = `OR({Telephone_contact}="${p}", {Telephone_Mari}="${p}", {Telephone_Femme}="${p}")`;
  const json = await core.at(`${core.atUrl()}?maxRecords=5&filterByFormula=${encodeURIComponent(formula)}`);
  const recs = json.records || [];
  const mode = (r) => String((r.fields || {}).Statut_Coach_IA || '');
  return recs.find((r) => /^MODE_/.test(mode(r))) || recs[0] || null;
}
const patch = (id, fields) => core.atWrite('PATCH', core.atUrl(`/${id}`), fields);

async function runIntake(from, body, profileName, ctx = {}) {
  let rec = await findByPhone(from);
  // Message venant du quiz : « réf. recXXXX-xxxxxxxx » -> on rattache ce numéro à la fiche du quiz
  const refId = core.parseRef(body);
  if (refId && !(rec && /^MODE_/.test(String((rec.fields || {}).Statut_Coach_IA || '')))) {
    try {
      const qrec = await core.at(core.atUrl(`/${refId}`));
      if (qrec && qrec.id && !(qrec.fields || {}).Telephone_contact) {
        await patch(qrec.id, { Telephone_contact: from });
        qrec.fields = { ...(qrec.fields || {}), Telephone_contact: from };
      }
      if (qrec && qrec.id) rec = qrec;
    } catch (e) { console.error('[whatsapp-intake] réf:', e.message); }
  }
  const f = (rec && rec.fields) || {};
  const status = String(f.Statut_Coach_IA || '');
  if (rec && rec.id) ctx.recId = rec.id;

  if (status === 'MODE_BILAN' || status === 'MODE_VIP') return { handled: false };

  if (status === 'MODE_SOUTIEN') {
    const step = String(f.Etape_onboarding || '');
    if (!['nom', 'email', 'defi'].includes(step)) return { handled: false };
    const text = String(body || '').trim();
    const looksFree = text.length > 120 || (step !== 'defi' && text.includes('?'));
    if (looksFree) { await patch(rec.id, { Etape_onboarding: 'fini' }); return { handled: false }; }

    if (step === 'nom') {
      if (isSkip(text)) { await patch(rec.id, { Etape_onboarding: 'email' }); return { handled: true, reply: T.askEmail('') }; }
      const n = parseName(text);
      if (!n) { await patch(rec.id, { Etape_onboarding: 'fini' }); return { handled: false }; }
      const upd = { Etape_onboarding: 'email', Prenom_contact: n.prenom };
      if (n.nom) upd.Nom_Famille = n.nom;
      await patch(rec.id, upd);
      return { handled: true, reply: T.askEmail(n.prenom) };
    }
    if (step === 'email') {
      const m = EMAIL_RE.exec(text);
      if (m) {
        const email = m[0].toLowerCase();
        const other = await core.findByEmail(email).catch(() => null);
        if (other && other.id !== rec.id) {
          // cet e-mail a déjà une fiche (ex. quiz) : on y rattache le numéro et l'essai, la fiche WhatsApp est mise de côté
          ctx.recId = other.id;
          await patch(other.id, { Telephone_contact: from, Statut_Coach_IA: 'MODE_SOUTIEN', Date_debut_essai: f.Date_debut_essai || core.parisDate(), Etape_onboarding: 'defi', Rappel_essai_envoye: false });
          await patch(rec.id, { Telephone_contact: '', Statut_Coach_IA: null, Etape_onboarding: 'fini', Notes_coach_humain: `Fiche fusionnée avec ${other.id} (même e-mail, numéro ${from}).` });
        } else {
          await patch(rec.id, { Etape_onboarding: 'defi', Email_contact: email });
        }
        return { handled: true, reply: T.askDefi };
      }
      if (isSkip(text)) { await patch(rec.id, { Etape_onboarding: 'defi' }); return { handled: true, reply: T.askDefi }; }
      await patch(rec.id, { Etape_onboarding: 'fini' }); return { handled: false };
    }
    // step === 'defi' : on range la réponse, puis le Coach IA répond à son contenu
    await patch(rec.id, isSkip(text) ? { Etape_onboarding: 'fini' } : { Etape_onboarding: 'fini', Defi_principal: text.slice(0, 2000) });
    return { handled: false };
  }

  // numéro inconnu ou pas encore activé
  if (!isYes(body)) return { handled: true, reply: T.invite };
  const today = core.parisDate();
  const pname = String(profileName || '').trim().slice(0, 60);
  if (rec) {
    const upd = { Statut_Coach_IA: 'MODE_SOUTIEN', Date_debut_essai: today, Etape_onboarding: 'nom', Rappel_essai_envoye: false };
    if (!f.Prenom_contact && !f['Prénom_contact'] && pname) upd.Prenom_contact = pname;
    await patch(rec.id, upd);
  } else {
    const fields = {
      Telephone_contact: from, Source: 'Coach_IA', Statut_Client: 'Prospect', Date_premier_contact: today,
      Statut_Coach_IA: 'MODE_SOUTIEN', Date_debut_essai: today, Etape_onboarding: 'nom',
    };
    if (pname) fields.Prenom_contact = pname;
    const made = await core.atWrite('POST', core.atUrl(), fields);
    ctx.recId = made && made.id;
  }
  return { handled: true, reply: T.welcome };
}

async function logExchange(recId, userText, reply, name) {
  const url = `https://api.airtable.com/v0/${process_env('AIRTABLE_BASE_ID') || 'appoelLZhjYcrttEa'}/tblB1AFnEiYW9xonr`;
  const now = Date.now();
  const rows = [];
  if (String(userText || '').trim()) rows.push({ 'Lien couple': [recId], Message: String(userText).slice(0, 4000), Timestamp: new Date(now - 2000).toISOString(), Qui_a_parle: String(name || 'Utilisateur').slice(0, 60) });
  if (reply) rows.push({ 'Lien couple': [recId], Message: String(reply).slice(0, 4000), Timestamp: new Date(now).toISOString(), Qui_a_parle: 'Coach_IA' });
  for (const fields of rows) {
    try { await core.at(url, { method: 'POST', body: JSON.stringify({ fields, typecast: true }) }); }
    catch (e) { console.error('[whatsapp-intake] historique:', e.message); }
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ handled: false, error: 'POST uniquement' });
  const secret = process_env('INTAKE_SECRET');
  const got = String(req.headers['x-intake-secret'] || '');
  const ok = secret && got.length === secret.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return res.status(401).json({ handled: false, error: 'Non autorisé' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  const from = String((b && b.from) || '').replace(/^whatsapp:/, '').replace(/[\s()-]/g, '');
  if (!/^\+?\d{6,20}$/.test(from)) return res.status(400).json({ handled: false, error: 'from invalide' });
  const body = String((b && b.body) || '').slice(0, 4000);

  try {
    const ctx = {};
    const out = await runIntake(from, body, b && b.profile_name, ctx);
    // on garde l'échange d'accueil dans l'historique : le Coach IA a ainsi du contexte (et une conversation à lire) dès le premier vrai message
    if (out.handled && ctx.recId) await logExchange(ctx.recId, body, out.reply, b && b.profile_name);
    out.action = out.handled ? 'reply' : 'ai';
    return res.status(200).json(out);
  } catch (e) {
    console.error('[whatsapp-intake]', e && e.message);
    // en cas de panne Airtable : on ne laisse pas la personne sans réponse
    return res.status(200).json({ handled: true, action: 'reply', reply: T.error });
  }
};
function process_env(k) { return String((global.process || {}).env[k] || ''); }
module.exports._test = { isYes, isSkip, parseName };
