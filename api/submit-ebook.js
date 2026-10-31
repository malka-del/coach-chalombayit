'use strict';
/**
 * L'ebook offert « Prépare Tichri avec ton couple » n'est plus disponible.
 * Cette route remplace l'ancienne fonction : elle ne crée plus de contact et n'envoie plus rien.
 * (Les navigateurs qui auraient encore l'ancien popup en cache recevront simplement une erreur propre.)
 */
module.exports = function handler(req, res) {
  const origin = req.headers && req.headers.origin;
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(410).json({ ok: false, error: "L'ebook offert pour Tichri n'est plus disponible." });
};
