'use strict';
/**
 * Les 9 emails (J0, J+3, J+10 × 3 profils) en HTML.
 * Tout est écrit à la première personne : il n'y a que moi derrière Chalom Bayit Le LAB.
 *
 * Pour modifier un texte : change la phrase dans CONTENT plus bas (le **gras** est pris en charge,
 * {prenom} est remplacé par le prénom). La mise en page est dans render().
 */

const LINKS = {
  seance: 'https://calendar.app.google/Lkb4zXnia5J5QkBE8',
  hybride: 'https://calendar.app.google/rknhu4FYNsacsKHF7',
  bilanIA: 'https://buy.stripe.com/8x29AU9FG4kK7uobRu6g801',
  essai: 'https://wa.me/33974997226?text=Bonjour%20!%20Je%20veux%20d%C3%A9marrer%20mon%20essai%20offert',
  site: 'https://coach.chalombayitlelab.com',
  abonnement: 'https://buy.stripe.com/dRmeVeg4418y3e89Jm6g800',
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// texte → HTML : échappe, puis **gras**, puis retours à la ligne
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1E293B;">$1</strong>').replace(/\n/g, '<br>');

const ACCENTS = {
  gold:  { bar: '#B8860B', kick: '#8C6512', btnBg: '#1E293B', btnFg: '#FEF3C7' },
  pink:  { bar: '#DB2777', kick: '#BE185D', btnBg: '#DB2777', btnFg: '#FFFFFF' },
  blue:  { bar: '#0284C7', kick: '#0369A1', btnBg: '#0284C7', btnFg: '#FFFFFF' },
  green: { bar: '#16A34A', kick: '#15803D', btnBg: '#25D366', btnFg: '#0B0C10' },
};
const HEADERS = {
  lune:    { from: '#B8860B', to: '#8C6512', accent: '#38BDF8' },
  agile:   { from: '#B8860B', to: '#8C6512', accent: '#F472B6' },
  urgence: { from: '#0E7490', to: '#155E75', accent: '#A5F3FC' }, // teintes apaisantes, pas de rouge
  essai:   { from: '#B8860B', to: '#8C6512', accent: '#38BDF8' },
};
const PROFIL_LABEL = { lune: 'Lune de Miel Active ✨', agile: 'Révision Agile Nécessaire 🔧', urgence: 'Urgence de Reconnexion 🌿' };

/* ───────────────────────── CONTENU ───────────────────────── */
function content(profil, etape, ctx) {
  const book = { card: true, accent: 'gold', kicker: 'Maintenance préventive', title: 'Chalom Bayit, Le LIVRE (54 défis)',
    desc: "54 défis hebdomadaires inspirés de la Paracha et alliés aux méthodes Agile : un rituel de 10 minutes par semaine pour entretenir et réaligner votre couple, un Chabbat à la fois.",
    label: '👉 Commander le livre sur Amazon →', href: ctx.bookUrl };
  const bookRevision = { ...book, kicker: 'Révision Agile' };
  const essai = { card: true, accent: 'green', kicker: 'Au quotidien · 7 jours offerts', title: 'Le Coach IA sur WhatsApp, 24h/24',
    desc: "Testez gratuitement pendant 7 jours : un coach disponible quand la tension monte, supervisé par moi.",
    label: '🎁 Démarrer mon essai offert →', href: LINKS.essai };
  const seance = (kicker, title, desc) => ({ card: true, accent: 'pink', kicker, title, desc,
    label: '📅 Réserver ma séance (100 €) →', href: LINKS.seance, price: '100 €' });
  const seanceCalme = (kicker, title, desc) => ({ ...seance(kicker, title, desc), accent: 'blue' });
  const bilanIA = { card: true, accent: 'gold', kicker: 'En autonomie', title: 'Bilan de couple complet avec le Coach IA',
    desc: "Un bilan approfondi à votre rythme, avec 1 mois d'accès au Coach IA inclus. 49 € au lieu de 79 € (prix de lancement).",
    label: '📊 Faire mon bilan IA →', href: LINKS.bilanIA };
  const hybride = { card: true, accent: 'pink', kicker: 'Bilan hybride', title: 'Le bilan IA + un debrief avec moi',
    desc: "Votre bilan avec le Coach IA, suivi d'un debrief de 30 minutes en visio avec moi. 89 € au lieu de 129 € (prix de lancement).",
    label: '📅 Réserver mon bilan →', href: LINKS.hybride };
  const seanceCiblee = seance('Séance ciblée', 'Une heure sur un point précis', "Pour débloquer une situation précise, seul(e) ou en couple. Vous repartez avec des outils concrets à appliquer dès le soir.");
  const ph = alisonPhone();
  const wa = ph
    ? { card: true, accent: 'green', kicker: 'Contact direct', title: 'M\'écrire sur WhatsApp',
        desc: `Voici mon numéro privé : ${ph.pretty}. Envoyez-moi un message ou une note vocale de 2 minutes pour m'expliquer votre situation. Je vous réponds personnellement.`,
        label: '💬 Ouvrir WhatsApp →', href: ph.href }
    : { card: true, accent: 'green', kicker: 'Contact direct', title: 'M\'écrire directement',
        desc: "Répondez simplement à cet e-mail pour m'expliquer votre situation. Je vous réponds personnellement.",
        label: '✉️ Répondre à ce mail →', href: 'mailto:malka@chalombayitlelab.com' };
  const reply = { p: "Une question, un doute ? **Répondez simplement à cet e-mail** : je lis tout et je réponds personnellement." };
  const sep = { sep: true };
  const SECU3 = "P.S. Si, à un moment, vous ne vous sentez pas en sécurité chez vous, ce n'est plus un sujet de coaching mais de protection : en France, le 3919 (gratuit et anonyme) ; en cas de danger immédiat, le 17 en France ou le 100 en Israël.";
  const SECU10 = "P.S. Si vous ne vous sentez pas en sécurité chez vous : 3919 en France (gratuit et anonyme) ; en cas de danger immédiat, le 17 en France ou le 100 en Israël.";

  const C = {
    'J0:lune': {
      subject: 'Votre résultat {prenom}, votre couple a de vraies ressources ✨',
      pre: 'Votre profil : Lune de Miel Active. Voici par où continuer.',
      kicker: 'Votre résultat au quiz', title: 'Lune de Miel Active ✨', sub: 'Votre couple a de vraies ressources',
      blocks: [
        { score: true },
        { p: "Vos réponses me disent quelque chose d'important : vous avez de **vraies fondations**. Vous communiquez, vous vous reconnaissez, vous avancez ensemble. C'est une force réelle." },
        { p: "Les couples qui durent ne le doivent pas au hasard. Ils ont appris à entretenir ce qu'ils ont construit, à le faire grandir avant que les défis n'arrivent." },
        { p: "Vous êtes dans la meilleure position pour aller encore plus loin, avec beaucoup moins d'efforts qu'un couple qui attend la crise." },
        sep, { label: 'Pour entretenir et réviser votre couple' }, book, essai, reply,
      ],
    },
    'J0:agile': {
      subject: 'Votre résultat {prenom}, votre couple a tout pour aller plus loin 🔧',
      pre: 'Votre profil : Révision Agile Nécessaire. Des signaux à écouter avant qu\'ils ne deviennent une panne.',
      kicker: 'Votre résultat au quiz', title: 'Révision Agile Nécessaire 🔧', sub: 'Un signal, pas un échec',
      blocks: [
        { score: true },
        { p: "Vos réponses me montrent un couple qui fonctionne et qui sent qu'il pourrait **tellement mieux fonctionner**. Ces zones de friction que vous ressentez ? Ce sont des signaux. Pas des signes d'échec : des opportunités de croissance." },
        { p: "La bonne nouvelle : vous êtes exactement là où le travail est le plus efficace. Assez tôt pour que les changements soient profonds et durables, avec toutes les ressources nécessaires pour y arriver." },
        { p: "En Agile, on n'attend pas que le système plante pour faire une mise à jour. Vous avez choisi d'agir maintenant. C'est le bon choix." },
        sep, { label: 'Pour rallumer la flamme, à votre rythme' },
        seance('Coaching privé', 'Une séance avec moi, en visio', "Une séance sur mesure pour réaligner vos besoins, désamorcer les non-dits et repartir avec des actions concrètes."),
        bookRevision, bilanIA, reply,
      ],
    },
    'J0:urgence': {
      subject: 'Votre résultat {prenom}, il y a un chemin 🌿',
      pre: 'Ce que vous vivez est difficile, mais ce n\'est pas une fatalité.',
      kicker: 'Votre résultat au quiz', title: 'Urgence de Reconnexion 🌿', sub: 'Il y a un chemin',
      blocks: [
        { score: true },
        { p: "Vos réponses me parlent d'un couple qui souffre en ce moment. Et je veux vous dire quelque chose d'important : ce que vous vivez est difficile, et en même temps vous avez fait quelque chose de **courageux** aujourd'hui. Vous avez osé regarder la situation en face. C'est déjà un premier pas." },
        { p: "Des couples qui vivaient exactement ce que vous décrivez ont réussi à se reconstruire. Pas en changeant de partenaire : en changeant de méthode. En apprenant à se parler autrement, à se reconnecter, à avancer ensemble plutôt que l'un contre l'autre." },
        { p: "Ce chemin existe. Et il commence par une conversation." },
        { p: "Même si cela vous paraît difficile, ma méthode peut vous aider. Et si votre conjoint(e) n'est pas prêt(e) à venir, ce n'est pas un obstacle : on en parle ensemble lors de la séance." },
        sep,
        seanceCalme('Priorité reconnexion', 'Une séance pour poser la situation à plat', "En visio, seul(e) ou en couple. Vous n'avez rien à préparer : on part de là où vous en êtes."),
        wa,
      ],
    },

    'J3:lune': {
      subject: '{prenom}, un rituel de 10 minutes pour garder votre couple en forme',
      pre: 'La rétrospective de couple : un outil Agile simple, à essayer cette semaine.',
      kicker: 'Mon conseil du jour', title: 'La rétrospective de couple', sub: 'Un rituel de 10 minutes par semaine',
      blocks: [
        { p: "Il y a quelques jours, vous découvriez votre profil : Lune de Miel Active. Aujourd'hui, je voudrais vous laisser un outil très simple, issu de la méthode Agile que j'utilise depuis plus de 12 ans en entreprise et que j'ai adaptée aux couples." },
        { p: "Une fois par semaine, 10 minutes, dans un moment calme (avant Chabbat, ou un soir tranquille), chacun répond à trois questions :" },
        { steps: ["Qu'est-ce qui a **bien marché** entre nous cette semaine ?", "Qu'est-ce qui aurait pu **mieux se passer** ?", "Quelle **petite action concrète** essayons-nous la semaine prochaine ?"] },
        { p: "Deux règles : on commence toujours par le positif, et on parle de situations, jamais des défauts de l'autre." },
        { p: "Les couples solides n'attendent pas la panne pour ajuster : ils ajustent en continu. C'est Chalom Bayit, la paix du foyer, vécue comme une pratique plutôt que comme un idéal." },
        sep, { label: 'Si vous voulez aller plus loin dans cet entretien régulier' }, book,
      ],
    },
    'J3:agile': {
      subject: '{prenom}, la phrase qui change beaucoup de disputes',
      pre: 'Une zone de friction très fréquente, et très simple à corriger.',
      kicker: 'Mon conseil du jour', title: 'La demande spécifique', sub: 'Une petite phrase, un grand effet',
      blocks: [
        { p: "Votre profil au quiz : Révision Agile Nécessaire. Parmi les zones de friction que je vois le plus souvent en séance, il y en a une étonnamment simple à corriger : **la demande vague**." },
        { p: "« Aide-moi plus. » « Tu pourrais faire un effort. » Votre partenaire entend un reproche plutôt qu'une demande, et ne sait pas quoi faire concrètement. Résultat : de la frustration des deux côtés." },
        { quote: "« Peux-tu [action précise] [à quel moment] ? »", cap: "Par exemple : « Peux-tu sortir les poubelles ce soir à 19h ? » plutôt que « Aide-moi plus »." },
        { p: "Ajoutez un deuxième réflexe, tout aussi simple : **un merci précis par jour**. Pas « merci pour tout », mais « merci d'avoir appelé le plombier, ça m'a enlevé un poids ». La reconnaissance précise change l'ambiance bien plus vite qu'on ne le croit." },
        sep, { label: 'Pour regarder ensemble vos zones de friction à vous, et pas des conseils génériques' }, bilanIA, hybride,
      ],
    },
    'J3:urgence': {
      subject: '{prenom}, une seule chose à essayer cette semaine',
      pre: 'Je ne vais pas vous noyer sous une liste d\'outils : une seule chose.',
      kicker: 'Je pense à vous', title: 'Une seule chose à essayer', sub: 'La pause avec retour',
      blocks: [
        { p: "Votre quiz m'a dit que vous traversez un moment difficile, et je ne vais pas vous noyer sous une liste d'outils. Je vous propose **une seule chose**, pour la prochaine fois que la tension monte : la pause avec retour." },
        { quote: "« Je ne veux pas qu'on se dise des choses qu'on regrette. Je fais une pause de 20 minutes et on en reparle à [heure]. »", cap: "Dites-le calmement, dès que vous sentez que ça dégénère." },
        { p: "Puis, et c'est le plus important, **revenez à l'heure dite**. Une pause sans retour, c'est de la fuite. Une pause avec retour, c'est protéger le lien. Elle n'a pas besoin d'être parfaite : une seule tentative suffit pour commencer à changer la dynamique." },
        { p: "Et si votre conjoint(e) n'est pas prêt(e) à venir vers le coaching ? Ce n'est pas un obstacle. Un couple est un système : quand l'un des deux change sa façon de faire, tout le système bouge. On peut très bien commencer seul(e)." },
        sep, { label: 'Pour en parler, quand vous le sentez' }, wa,
        seanceCalme('Une heure pour vous', 'Une séance avec moi', "En visio, seul(e) ou en couple."),
        { note: SECU3 },
      ],
    },

    'J10:lune': {
      subject: '{prenom}, où en êtes-vous ?',
      pre: 'Dix jours après votre quiz : un petit mot pour prendre de vos nouvelles.',
      kicker: 'Un petit mot de ma part', title: 'Où en êtes-vous ?', sub: 'Dix jours après votre quiz',
      blocks: [
        { p: "Cela fait une dizaine de jours que vous avez fait le quiz. Avez-vous eu l'occasion d'essayer la rétrospective de couple ? Si oui, j'aimerais beaucoup savoir ce qu'elle a donné : **répondez simplement à cet e-mail**, je lis et je réponds personnellement." },
        { p: "Si non, aucun souci. Un couple en bonne santé n'est pas un couple sans friction : c'est un couple qui se donne des rendez-vous réguliers pour s'ajuster." },
        sep, { label: 'Selon votre envie du moment' }, book, essai,
        seance('Si vous voulez en parler', 'Une séance avec moi', "Une heure en visio, seul(e) ou en couple, pour repartir avec des outils concrets."),
      ],
    },
    'J10:agile': {
      subject: '{prenom}, ce que 7 séances ont changé pour David et Sarah',
      pre: 'Un exemple concret (prénoms modifiés) de ce qui est possible.',
      kicker: 'Un exemple concret', title: 'David et Sarah', sub: 'Prénoms modifiés',
      blocks: [
        { p: "Je repense à votre quiz, et je voulais partager un exemple concret." },
        { compare: { before: [['Soutien mutuel', '2 / 5'], ['Vie intime', '2 / 5'], ['Gestion des conflits', '2 / 5'], ['Vision commune', 'Désalignée']],
                     after:  [['Soutien mutuel', '4 / 5'], ['Vie intime', '4 / 5'], ['Gestion des conflits', '4,5 / 5'], ['Vision commune', 'Alignée ✓']],
                     cap: "Auto-évaluation par le couple, au début puis à la fin de 7 séances." } },
        { p: "Rien de magique : une méthode, des actions concrètes entre chaque séance, et la décision d'agir **avant** que ça s'aggrave. Vous êtes exactement à ce moment-là : un signal, pas une panne." },
        { p: "Vous n'avez pas besoin de vous engager sur 7 séances pour commencer. Voici des points d'entrée plus légers :" },
        hybride, seanceCiblee, essai,
        { p: "Ou simplement **répondez à cet e-mail** : je lis tout." },
      ],
    },
    'J10:urgence': {
      subject: '{prenom}, je prends de vos nouvelles',
      pre: 'Sans aucune pression : un petit mot, dix jours après votre quiz.',
      kicker: 'Un petit mot de ma part', title: 'Je prends de vos nouvelles', sub: 'Sans aucune pression',
      blocks: [
        { p: "Dix jours se sont écoulés depuis votre quiz. Je ne sais pas où vous en êtes aujourd'hui, et je n'ai aucune pression à vous mettre. Peut-être que les choses se sont un peu apaisées, peut-être que c'est plus dur. Les deux sont normaux." },
        { p: "Si vous avez essayé la pause avec retour, même une seule fois, **bravo** : c'est un vrai premier pas. Si vous n'y êtes pas arrivé(e), ce n'est pas un échec : cela veut simplement dire que ce genre d'outil fonctionne mieux accompagné." },
        { p: "Ce que je sais : la très grande majorité des couples qui souffrent peuvent se reconstruire, et vous n'avez pas à continuer comme ça. Une séance d'une heure suffit pour poser les choses, voir ce qui est possible et repartir avec un premier plan." },
        sep,
        seanceCalme('Quand vous êtes prêt(e)', 'Une séance avec moi', "En visio, seul(e) ou en couple. Vous n'avez rien à préparer."),
        wa,
        { p: "Vous pouvez aussi simplement **répondre à cet e-mail**." },
        { note: SECU10 },
      ],
    },
    'J6:essai': {
      subject: '{prenom}, demain, votre essai du Coach IA se termine',
      pre: 'Un petit mot pour que vous ne soyez pas pris(e) de court.',
      reason: "Vous avez démarré votre essai offert du Coach IA sur WhatsApp.",
      kicker: 'Votre essai offert', title: 'Demain, votre essai se termine', sub: 'Pour continuer à avancer, sans interruption',
      blocks: [
        { p: "Voilà 6 jours que vous échangez avec Notre coach de poche, et **demain, votre essai offert de 7 jours se termine**." },
        { p: "Si ces échanges vous ont aidé(e), même un peu, à poser un mot, à respirer avant de répondre, à voir votre couple autrement, vous pouvez continuer avec le même coach, disponible à toute heure, **sans interruption**." },
        { card: true, accent: 'gold', kicker: 'Pour continuer', title: 'Je m\'abonne au Coach IA',
          desc: "Vous gardez le même coach sur WhatsApp, avec votre historique et son suivi, supervisé par moi. Sans engagement de durée.",
          label: '✨ Poursuivre avec le Coach IA →', href: LINKS.abonnement },
        { p: "Vous n'êtes pas sûr(e) que ce soit le bon moment, ou vous avez une question ? **Répondez simplement à cet e-mail** : je lis tout et je réponds personnellement." },
        sep, { label: 'Pour aller plus loin' },
        bilanIA,
        seanceCalme('Ou directement avec moi', 'Une séance avec moi', "En visio, seul(e) ou en couple. Vous n'avez rien à préparer."),
        { note: "Si vous ne souhaitez pas poursuivre, vous n'avez rien à faire : votre essai s'arrête simplement, sans aucun prélèvement." },
      ],
    },
  };
  return C[`${etape}:${profil}`];
}

/* ───────────────────────── RENDU ───────────────────────── */
const F_SERIF = "Georgia,'Times New Roman',serif";
const F_SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const F_MONO = "'Courier New',Courier,monospace";

function renderBlock(b, ctx) {
  if (b.card) {
    const a = ACCENTS[b.accent];
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr><td style="background:#fff;border:1px solid #E2D8CC;border-left:4px solid ${a.bar};border-radius:8px;padding:14px 16px;">
      <p style="font-family:${F_MONO};font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:${a.kick};margin:0 0 4px;">${esc(b.kicker)}</p>
      <p style="font-family:${F_SANS};font-size:15px;font-weight:700;color:#1E293B;margin:0 0 4px;">${esc(b.title)}</p>
      <p style="font-family:${F_SANS};font-size:13px;color:#475569;line-height:1.6;margin:0 0 12px;">${esc(b.desc)}</p>
      <a href="${esc(b.href)}" style="display:inline-block;background:${a.btnBg};color:${a.btnFg};text-decoration:none;font-family:${F_MONO};font-size:12px;font-weight:700;padding:10px 18px;border-radius:22px;">${esc(b.label)}</a>
    </td></tr></table>`;
  }
  if (b.p) return `<p style="font-family:${F_SANS};font-size:15px;color:#475569;line-height:1.75;margin:0 0 16px;">${rich(sub(b.p, ctx))}</p>`;
  if (b.label) return `<p style="font-family:${F_MONO};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#B8860B;margin:0 0 12px;">${esc(sub(b.label, ctx))}</p>`;
  if (b.note) return `<p style="font-family:${F_SANS};font-size:12px;color:#64748B;line-height:1.65;margin:8px 0 16px;">${esc(b.note)}</p>`;
  if (b.sep) return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="border-top:1px solid #E2D8CC;"></td><td width="1" style="padding:0 10px;color:#B8860B;font-size:13px;white-space:nowrap;">✦</td><td style="border-top:1px solid #E2D8CC;"></td></tr></table>`;
  if (b.score) {
    const pct = Math.round((ctx.score / 30) * 100);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:#F8F4EC;border:1px solid #E2D8CC;border-radius:10px;padding:14px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:${F_MONO};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8C6512;">Votre score au quiz</td>
        <td align="right" style="font-family:${F_SERIF};font-size:22px;font-weight:700;color:#1E293B;">${esc(ctx.score)} <span style="font-size:13px;font-weight:400;color:#64748B;">/ 30</span></td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;"><tr>
        <td width="${Math.max(pct, 3)}%" style="background:${ctx.hdr.from};height:8px;border-radius:8px;font-size:0;line-height:0;">&nbsp;</td>
        <td width="${100 - Math.max(pct, 3)}%" style="background:#E7E0D3;height:8px;border-radius:8px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    </td></tr></table>`;
  }
  if (b.steps) return b.steps.map((t, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;"><tr>
      <td width="34" valign="top"><div style="width:26px;height:26px;border-radius:13px;background:#B8860B;color:#fff;font-family:${F_SERIF};font-size:14px;font-weight:700;line-height:26px;text-align:center;">${i + 1}</div></td>
      <td style="font-family:${F_SANS};font-size:15px;color:#475569;line-height:1.6;padding-top:2px;">${rich(t)}</td></tr></table>`).join('') + '<div style="height:6px;"></div>';
  if (b.quote) return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:#FEF3C7;border-left:4px solid #B8860B;border-radius:8px;padding:16px 18px;">
      <p style="font-family:${F_SERIF};font-style:italic;font-size:18px;color:#1E293B;line-height:1.5;margin:0${b.cap ? ' 0 8px' : ''};">${esc(b.quote)}</p>
      ${b.cap ? `<p style="font-family:${F_SANS};font-size:12.5px;color:#64748B;line-height:1.6;margin:0;">${esc(b.cap)}</p>` : ''}</td></tr></table>`;
  if (b.compare) {
    const col = (title, color, rows) => `<td width="50%" valign="top" style="background:#fff;border:1px solid #E2D8CC;border-radius:8px;padding:10px 9px;">
      <p style="font-family:${F_MONO};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${color};margin:0 0 8px;">${title}</p>
      ${rows.map(([l, v]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-family:${F_SANS};font-size:12px;color:#64748B;padding:4px 4px 4px 0;">${esc(l)}</td><td align="right" style="font-family:${F_SANS};font-size:13px;font-weight:700;color:${color};padding:4px 0;" valign="top">${esc(v)}</td></tr></table>`).join('')}</td>`;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;"><tr>${col('Avant', '#B45309', b.compare.before)}<td width="10" style="font-size:0;">&nbsp;</td>${col('Après 7 séances', '#15803D', b.compare.after)}</tr></table>
      <p style="font-family:${F_SANS};font-size:11.5px;color:#64748B;margin:0 0 16px;text-align:center;">${esc(b.compare.cap)}</p>`;
  }
  return '';
}

const sub = (s, ctx) => String(s).replace(/\{prenom\}/g, ctx.prenom);

/* Numéro privé d'Alison : lu dans la variable Vercel ALISON_WA (jamais dans le code public). Il n'apparaît que dans les mails envoyés. */
function alisonPhone() {
  const n = String(process.env.ALISON_WA || '').replace(/\D/g, '');
  if (n.length < 8) return null;
  const pretty = n.startsWith('33') && n.length === 11
    ? '+33 ' + n.slice(2, 3) + ' ' + n.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ').trim()
    : '+' + n;
  return { href: 'https://wa.me/' + n, pretty };
}
function buildEmail({ etape, profil, prenom, score, unsubUrl, bookUrl }) {
  const ctx = { prenom: String(prenom || '').trim() || 'Bonjour', score: Number(score), bookUrl: bookUrl || 'https://amzn.eu/d/0fQNaUXS', hdr: HEADERS[profil] };
  ctx.prenom = ctx.prenom === 'Bonjour' ? '' : ctx.prenom;
  const c = content(profil, etape, ctx);
  if (!c) throw new Error(`Email inconnu : ${etape}:${profil}`);
  const hello = ctx.prenom ? `Bonjour ${esc(ctx.prenom)},` : 'Bonjour,';
  const subject = sub(c.subject, ctx).replace(/[<>\r\n]/g, '').replace(/^, /, '').replace(/^\s+/, '');
  const h = ctx.hdr;
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#EAE6DE;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(sub(c.pre, ctx))}${'&nbsp;&zwnj;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EAE6DE;"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#FFFDF9;border-radius:16px;border:1px solid #E2D8CC;">
    <tr><td bgcolor="${h.from}" style="background:${h.from};background:linear-gradient(135deg,${h.from},${h.to});border-radius:16px 16px 0 0;padding:28px 28px 22px;text-align:center;">
      <p style="font-family:${F_MONO};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.7);margin:0 0 8px;">✦ CHALOM BAYIT LE LAB ✦</p>
      <p style="font-family:${F_MONO};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${h.accent};margin:0 0 6px;">${esc(c.kicker)}</p>
      <h1 style="font-family:${F_SERIF};font-size:26px;font-weight:700;color:#ffffff;margin:0 0 4px;line-height:1.2;">${esc(c.title)}</h1>
      <p style="font-family:${F_SERIF};font-style:italic;font-size:15px;color:rgba(255,255,255,.88);margin:0;">${esc(c.sub)}</p>
    </td></tr>
    <tr><td style="padding:26px 28px 8px;">
      <p style="font-family:${F_SANS};font-size:16px;color:#1E293B;margin:0 0 14px;">${hello}</p>
      ${c.blocks.map((b) => renderBlock(b, ctx)).join('\n      ')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E2D8CC;margin-top:10px;"><tr><td style="padding-top:16px;">
        <p style="font-family:${F_SANS};font-size:14px;color:#475569;margin:0 0 10px;">À très bientôt,</p>
        <p style="font-family:${F_SANS};font-size:15px;font-weight:700;color:#1E293B;margin:0 0 2px;">Malka Alison</p>
        <p style="font-family:${F_MONO};font-size:10px;color:#0284C7;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Madrihat Kala &amp; Coach de couple</p>
        <p style="font-family:${F_SANS};font-size:12.5px;color:#475569;line-height:1.7;margin:0 0 18px;">Chalom Bayit Le LAB · <a href="${LINKS.site}" style="color:#B8860B;text-decoration:none;">coach.chalombayitlelab.com</a><br>Instagram : @ChalomBayit_LeLAB</p>
      </td></tr></table>
    </td></tr>
  </table>
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;"><tr><td style="padding:16px 12px 0;text-align:center;">
    <p style="font-family:${F_SANS};font-size:11.5px;color:#7C766B;line-height:1.7;margin:0;">${esc(c.reason || 'Vous recevez cet e-mail parce que vous avez fait mon quiz sur coach.chalombayitlelab.com.')}<br>Si vous répondez à ce message, c'est moi qui vous lis.<br><a href="${esc(unsubUrl)}" style="color:#7C766B;text-decoration:underline;">Me désinscrire en 1 clic</a></p>
  </td></tr></table>
</td></tr></table>
</body></html>`;
  return { subject, html };
}

module.exports = { buildEmail, PROFIL_LABEL, LINKS };
