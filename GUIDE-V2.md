# Guide de mise en ligne — quiz d'accueil + séquence de mails HTML

## Ce qui change
- Le quiz s'ouvre **automatiquement dès l'arrivée** sur le site (accroche : « Votre couple est-il équipé pour durer ? »). Visiteur qui ferme : bouton flottant « Faire le test » ; quiz terminé : plus d'ouverture automatique. Variante : ajouter `?v=alya` à l'adresse → « Votre couple est-il prêt pour l'alya ? ».
- Prénom, e-mail et **case de consentement** obligatoires ; nom et téléphone facultatifs. Résultat affiché en ligne, CTA par profil (Urgence : ton apaisant, 🌿, pas de rouge).
- Le navigateur n'appelle **plus Make** : il appelle Vercel (`/api/submit-quiz`), qui recalcule le score, enregistre dans Airtable, génère le mail HTML (à la première personne) et le passe à Make.
- Séquence : mail immédiat, J+3 (fenêtre 3–6 jours), J+10 (fenêtre 10–14 jours), via le cron Vercel quotidien. Lien de désinscription signé, avec confirmation.
- Ebook Tichri : supprimé (`api/submit-ebook` renvoie 410). WhatsApp Coach IA : +33 9 74 99 72 26.

## 1. Fichiers à mettre dans le dépôt (branche `quiz-v2`)
`index.html` (remplace l'actuel, overlay inclus), `api/submit-quiz.js`, `api/unsubscribe.js`, `api/cron-sequence.js`, `api/submit-ebook.js`, `api/_lib/core.js`, `api/_lib/emails.js`, et dans `vercel.json` : `{ "crons": [{ "path": "/api/cron-sequence", "schedule": "0 7 * * *" }] }` (à fusionner avec l'existant). Supprimer le fichier popup ebook Tichri s'il est dans le dépôt. `quiz-overlay.html` n'est qu'une copie de travail (déjà intégrée à `index.html`).

## 2. Variables d'environnement Vercel
`AIRTABLE_TOKEN`, `MAKE_QUIZ_WEBHOOK_URL`, `UNSUB_SECRET` (chaîne aléatoire longue), `CRON_SECRET` (autre chaîne aléatoire), `BOOK_URL` (facultatif, par défaut https://amzn.eu/d/0fQNaUXS).

## 3. Airtable (« Couples & CRM »)
Créer, avec ces noms exacts : `Date_quiz` (date), `Reponses_quiz` (texte long), `Sequence_J3`, `Sequence_J10`, `Desinscrit` (cases à cocher). La séquence s'arrête dès que `Statut_Client` n'est plus « Prospect » ou que la personne se désinscrit.

## 4. Make (scénario très simple)
Importer `make/Quizz_site_Mails_HTML.blueprint.json` : Webhook → Gmail (corps HTML brut). Copier l'URL du webhook dans `MAKE_QUIZ_WEBHOOK_URL`, faire « Determine data structure » avec `make/payload-exemple.json`. Si l'import coince : module Gmail « Envoyer un e-mail », destinataire `{{1.email}}`, objet `{{1.subject}}`, type de contenu HTML, contenu `{{1.html}}`. Make n'écrit plus dans Airtable. Désactiver l'ancien scénario Jotform.

## 5. Test sur la préversion Vercel (avant fusion)
1. Ouvrir l'URL de préversion en navigation privée : le quiz s'ouvre seul. Faire les 3 profils, vérifier mail reçu + ligne Airtable.
2. `/api/cron-sequence?dry=1` avec l'en-tête `Authorization: Bearer <CRON_SECRET>` liste ce qui partirait sans rien envoyer.
3. Lien de désinscription d'un mail : `Desinscrit` doit se cocher.
4. Les aperçus des 9 mails sont dans `emails/apercus/` (ouvrir dans un navigateur).

## À relire
Textes des 9 mails (`api/_lib/emails.js`), prix cités (49 €, 89 €, 100 €), ordre de la signature (« Malka Alison », comme dans ton exemple) ; ton numéro perso vit uniquement dans la variable Vercel `ALISON_WA`.
