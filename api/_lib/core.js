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
  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    data: {
      prenom, nom, email, telephone, answers,
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
    if (!f['Prénom_contact']) patch['Prénom_contact'] = d.prenom;
    if (!f.Nom_Famille && d.nom) patch.Nom_Famille = d.nom;
    if (!f.Telephone_contact && d.telephone) patch.Telephone_contact = d.telephone;
    if (!f.Email_contact && !f.Email_Femme && !f.Email_Mari) patch.Email_contact = d.email;
    if (f.Desinscrit) patch.Desinscrit = false; // nouveau consentement explicite
    const count = (Number(f.Nb_envois_quiz) || 0) + 1;
    patch.Nb_envois_quiz = count;
    await at(atUrl(`/${existing.id}`), { method: 'PATCH', body: JSON.stringify({ fields: patch, typecast: true }) });
    return { status: 'updated', count };
  }

  const fields = {
    'Prénom_contact': d.prenom,
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
  await at(atUrl(), { method: 'POST', body: JSON.stringify({ fields, typecast: true }) });
  return { status: 'created', count: 1 };
}

/* ───────────── Make ───────────── */
async function sendToMake(payload) {
  const url = process.env.MAKE_QUIZ_WEBHOOK_URL;
  if (!url) throw new Error('MAKE_QUIZ_WEBHOOK_URL manquant');
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.MAKE_API_KEY) headers['x-make-apikey'] = process.env.MAKE_API_KEY;
  const res = await fetchT(url, { method: 'POST', headers, body: JSON.stringify(payload) }, 8000);
  if (!res.ok) throw new Error(`Make ${res.status}`);
  return true;
}

function makePayload({ etape, profile, score, prenom, nom, email, telephone }) {
  const { buildEmail } = require('./emails');
  const unsub_url = unsubUrl(email);
  const { subject, html } = buildEmail({ etape, profil: profile.code, prenom, score, unsubUrl: unsub_url, bookUrl: bookUrl() });
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

module.exports = {
  POINTS, REVERSED, QUESTION_COUNT, PROFILES,
  scoreAnswers, profileFor, profileFromAirtable, validate, clean,
  parisDate, setCors, apiBase, signEmail, verifyEmail, unsubUrl, bookUrl, bookLine,
  alisonWaNumber, maxSends, fetchT, at, atUrl, fEsc, findByEmail, upsertProspect, sendToMake, makePayload,
};
