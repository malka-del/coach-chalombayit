'use strict';
/**
 * GET /api/ecrire-alison : redirige vers WhatsApp (numéro perso d'Alison) ou, à défaut, vers un e-mail.
 * Le numéro n'apparaît ni dans le code du site, ni dans les mails, ni dans la réponse du quiz :
 * il n'est révélé qu'au moment où la personne clique et ouvre WhatsApp.
 */
const core = require('./_lib/core');

module.exports = function handler(req, res) {
  const n = core.alisonWaNumber();
  const text = 'Bonjour Alison, voici mon audio de 2 minutes suite au quiz.';
  const target = n
    ? `https://wa.me/${n}?text=${encodeURIComponent(text)}`
    : 'mailto:malka@chalombayitlelab.com?subject=' + encodeURIComponent('Suite à mon quiz');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Location', target);
  return res.status(302).end();
};
