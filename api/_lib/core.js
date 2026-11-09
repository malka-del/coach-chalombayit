'use strict';
/**
 * Cœur partagé du quiz Chalom Bayit Le LAB.
 * Le dossier api/_lib n'est PAS exposé comme route par Vercel (préfixe "_").
 *
 * Variables d'environnement (Vercel → Settings → Environment Variables) :
 *   AIRTABLE_TOKEN          jeton Airtable (le même que celui de sync-airtable)
 *   MAKE_QUIZ_WEBHOOK_URL   URL du webhook Make « Quiz site »
 *   UNSUB_SECRET            longue chaîne aléatoire (signe les liens de désinscription)
 *   CRON_SECRET             longue chaîne aléatoire (Vercel l'envoie au cron)
 *   BOOK_URL                lien d'achat du livre (optionnel : défaut = lien Amazon)
 *   API_BASE_URL            optionnel, défaut https://coach-chalombayit.vercel.app
 *   MAKE_API_KEY            optionnel, si l'authentification par clé est activée sur le webhook Make
 *   Candidatures « couples fondateurs » (tous optionnels) :
 *   CANDIDATURE_RDV_URL           lien de la page de réservation Google Agenda (appel de candidature 15–30 min)
 *   CANDIDATURE_NOTIF_EMAIL       adresse qui reçoit l'alerte « nouvelle candidature » (défaut : malka@chalombayitlelab.com)
 *   MAKE_CANDIDATURE_WEBHOOK_URL  webhook d'un scénario Make dédié aux e-mails de candidature (défaut : MAKE_QUIZ_WEBHOOK_URL)
 *   CANDIDATURE_START / CANDIDATURE_END   fenêtre ISO (défaut : 2026-12-01T21:50+01:00 → 2026-12-20T22:00+01:00)
 *   CANDIDATURE_FORCE_OPEN=1      force l'ouverture (À METTRE UNIQUEMENT sur l'environnement « Preview » pour tester)
 *   AIRTABLE_BASE_ID / AIRTABLE_TABLE_ID   optionnels (valeurs par défaut = base « Production », table « Couples & CRM »)
 */
const crypto = require('crypto');

/* ───────────── Barème ───────────── */
const POINTS = { oui: 2, parfois: 1, non: 0 };
const REVERSED = [11, 14]; // Q12 et Q15 : barème inversé (index 0-based)
const QUESTION_COUNT = 15;

function scoreAnswers(answers) {
  const pillars = [0, 0, 0, 0, 0];
  let total = 0;
  answers.forEach((a, i) => {
    let pts = POINTS[a];
    if (REVERSED.includes(i)) pts = 2 - pts;
    total += pts;
    pillars[Math.floor(i / 3)] += pts;
  });
  return { total, pillars };
}

const PROFILES = {
  lune:    { code: 'lune',    airtable: 'Lune de Miel',   label: 'Lune de Miel Active',            priorite: 'Basse' },
  agile:   { code: 'agile',   airtable: 'Révision Agile', label: 'Révision Agile Nécessaire',      priorite: 'Moyenne' },
  urgence: { code: 'urgence', airtable: 'Urgence',        label: 'Urgence de Reconnexion',         priorite: 'Haute' },
};

function profileFor(score) {
  if (score <= 9) return PROFILES.lune;
  if (score <= 19) return PROFILES.agile;
  return PROFILES.urgence;
}

function profileFromAirtable(text) {
  const t = String(text || '').trim().toLowerCase();
  if (t.startsWith('lune')) return PROFILES.lune;
  if (t.startsWith('rév') || t.startsWith('rev')) return PROFILES.agile;
  if (t.startsWith('urgence')) return PROFILES.urgence;
  return null;
}

/* ───────────── Validation ───────────── */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/* ───────────── Candidature « couples fondateurs » ───────────── */
const CAND_DEFAULT = { start: '2026-12-01T21:50:00+01:00', end: '2026-12-20T22:00:00+01:00' };
const CAND_DUREES = ['moins_1_an', '1_a_3_ans', '3_a_10_ans', 'plus_10_ans'];
function candWindow() {
  return { start: process.env.CANDIDATURE_START || CAND_DEFAULT.start, end: process.env.CANDIDATURE_END || CAND_DEFAULT.end };
}
function candOpen(now = Date.now()) {
  if (process.env.CANDIDATURE_FORCE_OPEN === '1') return true;
  const w = candWindow();
  return now >= Date.parse(w.start) && now <= Date.parse(w.end);
}
const rdvUrl = () => (process.env.CANDIDATURE_RDV_URL || '').trim();
const candNotifEmail = () => (process.env.CANDIDATURE_NOTIF_EMAIL || 'malka@chalombayitlelab.com').trim();

/* Renvoie null si pas de candidature (ou incomplète) ; sinon l'objet nettoyé. */
function cleanCandidature(c) {
  if (!c || typeof c !== 'object' || c.active !== true) return null;
  const conjoint = c.conjoint === 'oui' || c.conjoint === 'pas_encore' ? c.conjoint : '';
  const duree = CAND_DUREES.includes(c.duree) ? c.duree : '';
  const dispo = c.dispo === 'oui' || c.dispo === 'a_discuter' ? c.dispo : '';
  if (!conjoint || !duree || !dispo || c.engagement !== true || c.consent !== true) return null;
  return { conjoint, duree, dispo, attentes: clean(c.attentes, 800).replace(/\s+/g, ' ') };
}
const candStatut = (cand) => (cand.conjoint === 'oui' ? 'A_appeler' : 'A_confirmer');

function validate(body) {
  const errors = {};
  if (!body || typeof body !== 'object') return { ok: false, errors: { _: 'Requête invalide.' } };

  const prenom = clean(body.prenom, 60);
  const nom = clean(body.nom, 80);
  const email = clean(body.email, 254).toLowerCase();
  const telephone = clean(body.telephone, 25);

  if (!prenom) errors.prenom = 'Merci de renseigner votre prénom.';
  if (!email || !EMAIL_RE.test(email)) errors.email = "L'adresse email ne semble pas valide.";
  if (telephone && !/^\+?[\d\s().-]{7,25}$/.test(telephone)) errors.telephone = 'Numéro invalide (ex. +33 6 12 34 56 78).';
  if (body.consent !== true) errors.consent = 'Merci de cocher la case pour recevoir votre résultat.';

  const answers = body.answers;
  if (!Array.isArray(answers) || answers.length !== QUESTION_COUNT || !answers.every((a) => typeof a === 'string' && Object.prototype.hasOwnProperty.call(POINTS, a))) {
    errors.answers = 'Réponses incomplètes.';
  }
  const candidature = cleanCandidature(body.candidature);
  if (body.candidature && body.candidature.active && !candidature) errors.candidature = 'Candidature incomplète.';
  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      prenom, nom, email, telephone, answers, candidature,
      honeypot: clean(body.website, 100),
      source: clean(body.source, 200) || 'direct',
      page: clean(body.page, 300),
    },
  };
}

/* ───────────── Divers ───────────── */
function parisDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d); // YYYY-MM-DD
}

const ALLOWED_ORIGINS = [
  'https://coach.chalombayitlelab.com',
  'https://www.coach.chalombayitlelab.com',
  'https://coach-chalombayit.vercel.app',
];
function setCors(req, res) {
  const origin = req.headers && req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function apiBase() {
  return (process.env.API_BASE_URL || 'https://coach-chalombayit.vercel.app').replace(/\/$/, '');
}

/* ───────────── Désinscription signée ───────────── */
function signEmail(email) {
  const secret = process.env.UNSUB_SECRET;
  if (!secret) throw new Error('UNSUB_SECRET manquant');
  return crypto.createHmac('sha256', secret).update(String(email).trim().toLowerCase()).digest('base64url');
}
function verifyEmail(email, token) {
  try {
    const a = Buffer.from(signEmail(email));
    const b = Buffer.from(String(token || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}
/* Référence courte liée à une fiche (pour relier le WhatsApp de l'essai à la fiche du quiz) : id Airtable + signature. */
function makeRef(recId) {
  const secret = process.env.UNSUB_SECRET;
  if (!secret || !recId) return '';
  return `${recId}-${crypto.createHmac('sha256', secret).update('ref:' + recId).digest('base64url').slice(0, 8)}`;
}
function parseRef(text) {
  const m = /(rec[A-Za-z0-9]{14})-([A-Za-z0-9_-]{8})/.exec(String(text || ''));
  if (!m) return '';
  const want = makeRef(m[1]);
  const a = Buffer.from(want), b = Buffer.from(`${m[1]}-${m[2]}`);
  return want && a.length === b.length && crypto.timingSafeEqual(a, b) ? m[1] : '';
}

function unsubUrl(email) {
  return `${apiBase()}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${signEmail(email)}`;
}

function bookUrl() {
  return (process.env.BOOK_URL || 'https://amzn.eu/d/0fQNaUXS').trim(); // livre sur Amazon par défaut
}
/* Numéro WhatsApp perso d'Alison : uniquement en variable d'environnement Vercel (jamais dans le code public). */
function alisonWaNumber() {
  const n = String(process.env.ALISON_WA || '').replace(/\D/g, '');
  return n.length >= 8 ? n : '';
}
function maxSends() {
  const n = parseInt(process.env.QUIZ_MAX_SENDS, 10);
  return n > 0 ? n : 3;
}
function bookLine() {
  const url = bookUrl();
  if (url) return `📖 Découvrir mon livre : ${url}`;
  return '📖 Mon livre : répondez simplement à ce mail et je vous le transmets.';
}

/* ───────────── HTTP ───────────── */
async function fetchT(url, opts = {}, ms = 7000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/* ───────────── Airtable (API REST, noms de champs) ───────────── */
const BASE = () => process.env.AIRTABLE_BASE_ID || 'appoelLZhjYcrttEa';
const TABLE = () => process.env.AIRTABLE_TABLE_ID || 'tblTZoo9RyA2xUh16';
const atUrl = (p = '') => `https://api.airtable.com/v0/${BASE()}/${TABLE()}${p}`;

async function at(url, opts = {}) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error('AIRTABLE_TOKEN manquant');
  const res = await fetchT(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* ignore */ }
  if (!res.ok) {
    const msg = json && json.error ? (json.error.message || json.error.type || json.error) : text.slice(0, 200);
    const err = new Error(`Airtable ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

/* Le champ prénom existe sous « Prenom_contact » (production WhatsApp) ; on retente avec l'autre orthographe si Airtable ne le connaît pas. */
const ALIAS = { 'Prenom_contact': 'Prénom_contact', 'Prénom_contact': 'Prenom_contact' };
async function atWrite(method, url, fields) {
  const send = (f) => at(url, { method, body: JSON.stringify({ fields: f, typecast: true }) });
  try { return await send(fields); }
  catch (e) {
    const m = e.status === 422 && /Unknown field name: "([^"]+)"/.exec(e.message);
    if (m && ALIAS[m[1]] && Object.prototype.hasOwnProperty.call(fields, m[1])) {
      const f2 = {}; for (const k of Object.keys(fields)) f2[k === m[1] ? ALIAS[m[1]] : k] = fields[k];
      return send(f2);
    }
    throw e;
  }
}

const fEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

async function findByEmail(email) {
  const e = fEsc(email.toLowerCase());
  const formula = `OR(LOWER({Email_contact})="${e}", LOWER({Email_Femme})="${e}", LOWER({Email_Mari})="${e}")`;
  const json = await at(`${atUrl()}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`);
  return (json.records && json.records[0]) || null;
}

async function upsertProspect(d, result) {
  const today = parisDate();
  const details = JSON.stringify({
    version: 1, answers: d.answers, pillars: result.pillars,
    consent_email_at: new Date().toISOString(), source: d.source, page: d.page,
    ...(d.candidature ? { candidature: { ...d.candidature, consent_candidature_at: new Date().toISOString() } } : {}),
  });
  const existing = await findByEmail(d.email);

  if (existing) {
    const f = existing.fields || {};
    const patch = {
      Score_quiz: String(result.total),
      Profil_Quiz: result.profile.airtable,
      Priorite: result.profile.priorite,
      Reponses_quiz: details,
    };
    if (!f.Date_quiz) patch.Date_quiz = today;
    if (!f['Prenom_contact'] && !f['Prénom_contact']) patch['Prenom_contact'] = d.prenom;
    if (!f.Nom_Famille && d.nom) patch.Nom_Famille = d.nom;
    if (!f.Telephone_contact && d.telephone) patch.Telephone_contact = d.telephone;
    if (!f.Email_contact && !f.Email_Femme && !f.Email_Mari) patch.Email_contact = d.email;
    if (f.Desinscrit) patch.Desinscrit = false; // nouveau consentement explicite
    const count = (Number(f.Nb_envois_quiz) || 0) + 1;
    patch.Nb_envois_quiz = count;
    await atWrite('PATCH', atUrl(`/${existing.id}`), patch);
    return { status: 'updated', count, id: existing.id };
  }

  const fields = {
    'Prenom_contact': d.prenom,
    Email_contact: d.email,
    Score_quiz: String(result.total),
    Profil_Quiz: result.profile.airtable,
    Priorite: result.profile.priorite,
    Source: 'Quizz',
    Statut_Client: 'Prospect',
    Date_premier_contact: today,
    Date_quiz: today,
    Reponses_quiz: details,
    Nb_envois_quiz: 1,
  };
  if (d.nom) fields.Nom_Famille = d.nom;
  if (d.telephone) fields.Telephone_contact = d.telephone;
  const made = await atWrite('POST', atUrl(), fields);
  return { status: 'created', count: 1, id: made && made.id };
}

/* Enregistre la candidature sur la fiche (champs à créer dans Airtable, voir GUIDE-CANDIDATURES.md).
   Les réponses détaillées sont de toute façon dans Reponses_quiz (JSON) : en cas de champ manquant on le journalise sans bloquer. */
async function saveCandidature(recId, cand, extraDetails) {
  const fields = {
    Candidature_fondateur: true,
    Candidature_date: parisDate(),
    Candidature_statut: candStatut(cand),
    Candidature_conjoint: cand.conjoint,
    Candidature_duree: cand.duree,
    Candidature_dispo: cand.dispo,
    Candidature_attentes: cand.attentes || '',
  };
  if (extraDetails) fields.Reponses_quiz = extraDetails;
  try { await atWrite('PATCH', atUrl(`/${recId}`), fields); return true; }
  catch (e) { console.error('[candidature] Airtable (champs manquants ?):', e && e.message); return false; }
}

function signCand(email) {
  return signEmail('cand:' + String(email).trim().toLowerCase());
}
function confirmUrl(email) {
  return `${apiBase()}/api/confirm-candidature?e=${encodeURIComponent(email)}&t=${signCand(email)}`;
}
function verifyCand(email, token) {
  try {
    const a = Buffer.from(signCand(email)), b = Buffer.from(String(token || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

/* ───────────── Make ───────────── */
async function sendToMake(payload, urlOverride) {
  const url = urlOverride || process.env.MAKE_CANDIDATURE_WEBHOOK_URL || process.env.MAKE_QUIZ_WEBHOOK_URL;
  if (!url) throw new Error('MAKE_QUIZ_WEBHOOK_URL manquant');
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.MAKE_API_KEY) headers['x-make-apikey'] = process.env.MAKE_API_KEY;
  const res = await fetchT(url, { method: 'POST', headers, body: JSON.stringify(payload) }, 8000);
  if (!res.ok) throw new Error(`Make ${res.status}`);
  return true;
}

function makePayload({ etape, profile, score, prenom, nom, email, telephone, cand }) {
  const { buildEmail } = require('./emails');
  const unsub_url = unsubUrl(email);
  const { subject, html } = buildEmail({
    etape, profil: profile.code, prenom, score, unsubUrl: unsub_url, bookUrl: bookUrl(),
    cand: cand ? { statut: candStatut(cand), rdvUrl: rdvUrl(), confirmUrl: confirmUrl(email) } : null,
  });
  return {
    // ce que Make envoie tel quel (module Gmail, corps « HTML brut ») :
    email, subject, html,
    // pour mémoire / filtres dans Make :
    etape,                       // J0 | J3 | J10
    profil: profile.code,        // lune | agile | urgence
    profil_label: profile.label,
    score, prenom, nom: nom || '', telephone: telephone || '',
    unsub_url,
  };
}

/* Alerte pour Alison : même format que les autres envois (email/subject/html), donc le même module Gmail de Make suffit. */
function notifPayload({ prenom, nom, email, cand, score, profilLabel, late, confirmed }) {
  const L = { oui: 'Oui, ils en ont parlé', pas_encore: 'Pas encore (à confirmer)' };
  const D = { moins_1_an: 'moins d’un an', '1_a_3_ans': '1 à 3 ans', '3_a_10_ans': '3 à 10 ans', plus_10_ans: 'plus de 10 ans' };
  const e = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const titre = confirmed ? 'Candidature CONFIRMÉE' : (late ? 'Nouvelle candidature (après le quiz)' : 'Nouvelle candidature');
  const subject = `${titre} · ${String(prenom || '').replace(/[<>\r\n]/g, '')}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1E293B;line-height:1.6">
<h2 style="margin:0 0 8px">${e(titre)} — couples fondateurs</h2>
<p><strong>${e(prenom)} ${e(nom || '')}</strong> · <a href="mailto:${e(email)}">${e(email)}</a></p>
<ul><li>Conjoint(e) d'accord : <strong>${e(L[cand.conjoint] || cand.conjoint)}</strong></li>
<li>En couple depuis : ${e(D[cand.duree] || cand.duree)}</li>
<li>Disponibilité 3 à 6 mois : ${cand.dispo === 'oui' ? 'oui' : 'à discuter'}</li>
${score !== undefined && score !== '' ? `<li>Quiz : ${e(score)}/30 · ${e(profilLabel || '')}</li>` : ''}</ul>
<p><strong>Attentes :</strong><br>${e(cand.attentes || '(non renseignées)').replace(/\n/g, '<br>')}</p>
<p style="color:#64748B;font-size:13px">Statut Airtable : ${e(candStatut(cand))}. Appels de candidature du 2 décembre au 10 janvier.</p></div>`;
  return { email: candNotifEmail(), subject, html, etape: 'NOTIF_CAND', profil: 'cand', profil_label: 'Notification candidature', score: score === undefined ? '' : score, prenom: 'Alison', nom: '', telephone: '', unsub_url: '' };
}

module.exports = {
  CAND_DEFAULT, candWindow, candOpen, rdvUrl, candNotifEmail, cleanCandidature, candStatut, saveCandidature, confirmUrl, verifyCand, notifPayload,
  POINTS, REVERSED, QUESTION_COUNT, PROFILES,
  scoreAnswers, profileFor, profileFromAirtable, validate, clean,
  parisDate, setCors, apiBase, signEmail, verifyEmail, makeRef, parseRef, unsubUrl, bookUrl, bookLine,
  alisonWaNumber, maxSends, fetchT, at, atWrite, atUrl, fEsc, findByEmail, upsertProspect, sendToMake, makePayload,
};
