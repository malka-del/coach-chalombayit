# Candidatures « couples fondateurs » (branche `candidatures-fondateurs`)

## Parcours
1. **Pendant la période (1er déc. 21h50 → 20 déc. 22h00, heure de Paris)** : après la 15e question, un écran explique en quelques lignes la candidature (8 couples, 3 programmes offerts, sans prix).
   - **Je candidate** → 4 questions (conjoint d'accord / pas encore / non ; durée du couple ; dispo 3 à 6 mois ; attentes) + 2 cases (engagement en couple, consentement) → formulaire e-mail habituel → résultat du quiz + **« Votre candidature a bien été prise en compte »** + détail du programme et prix (294 + 100 + 300 + 54 = 748 € ; tarif fondateur 249 €) + lien de réservation de l'appel. Même contenu par e-mail (dans le mail de résultat).
   - **Non merci** → résultat habituel + bloc **« Candidater pour le programme de coaching hybride IA et supervision humaine »** (détail du programme, sans prix) → bouton « Je candidate » → mêmes questions → envoi direct (`/api/submit-candidature`) → bloc de confirmation + e-mail de confirmation.
   - « Conjoint : non » → pas de candidature (le programme se vit en couple), résultat du quiz normal.
   - « Conjoint : pas encore » → statut `A_confirmer` : e-mail avec lien signé « Nous confirmons notre candidature » (`/api/confirm-candidature`), relance à J+3 puis rappel le 18 décembre.
2. **Hors période** : aucun écran de candidature, aucun bloc (le quiz redevient identique à avant). Le serveur refuse aussi les candidatures hors fenêtre.
3. Chaque candidature envoie **une alerte à Alison** (`CANDIDATURE_NOTIF_EMAIL`) avec toutes les réponses.

## À créer dans Airtable (table « Couples & CRM », noms exacts)
`Candidature_fondateur` (case à cocher) · `Candidature_date` (date) · `Candidature_statut` (**texte sur une ligne** : `A_appeler`, `A_confirmer`, puis à la main `Appel_fait`, `Retenu`, `Offert`, `Refuse`) · `Candidature_conjoint`, `Candidature_duree`, `Candidature_dispo` (texte sur une ligne) · `Candidature_attentes` (texte long) · `Relance_cand_1`, `Relance_cand_2` (cases à cocher).
Si un champ manque, la candidature est quand même conservée dans `Reponses_quiz` (JSON, clé `candidature`) et l'alerte part.

## Présélection (manuelle)
Les candidats ne reçoivent **pas** le lien de réservation à la candidature : le mail et la page disent que tu étudies les candidatures et que, si la leur est présélectionnée, tu leur envoies ton agenda. Le mail de présélection est **envoyé à la main** depuis Gmail (modèle fourni par Claude). Dans Airtable, passe simplement `Candidature_statut` à `Preselectionne` pour garder la trace.

## Variables Vercel
- `CANDIDATURE_RDV_URL` : lien de la page de réservation Google Agenda (créneaux de 30 min, 13 déc. → 10 janv.). Sans lui, les e-mails disent « je vous écris pour fixer l'appel ».
- `CANDIDATURE_NOTIF_EMAIL` (facultatif, défaut malka@chalombayitlelab.com).
- `MAKE_CANDIDATURE_WEBHOOK_URL` (facultatif) : webhook d'un scénario Make dédié (même modèle Webhook → Gmail que le quiz). Sans lui, on utilise `MAKE_QUIZ_WEBHOOK_URL`.
- `CANDIDATURE_FORCE_OPEN=1` : **uniquement sur l'environnement Preview**, pour tester avant le 1er décembre. Aperçu côté navigateur : ajouter `?cand=1` à l'adresse.
- `CANDIDATURE_START` / `CANDIDATURE_END` (facultatif) : changer la fenêtre sans toucher au code (penser aussi aux constantes `CAND_START` / `CAND_END` dans `index.html`).

## Tests sur la préversion
1. `?cand=1` : faire le quiz, candidater (conjoint « oui », puis « pas encore »), vérifier : écran résultat, ligne Airtable, e-mail de résultat avec bloc candidature, alerte reçue.
2. Refaire le quiz sans candidater, puis cliquer « Je candidate » sur la page de résultat.
3. Lien de confirmation d'un e-mail « à confirmer » → statut `A_appeler` + e-mail avec le lien de réservation.
4. `/api/cron-sequence?dry=1` (en-tête `Authorization: Bearer <CRON_SECRET>`) liste les relances (`CAND_R1`, `CAND_R2`).

## Fermeture (après le 20 décembre)
Rien à faire : la fenêtre se referme seule (front et serveur). Les relances s'arrêtent aussi.
