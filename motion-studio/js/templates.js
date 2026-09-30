/* Lueur — les 50 templates.
   Chaque template est une suite de scènes posées sur une ligne de temps.
   obj : cognitif (faire comprendre), affectif (faire ressentir), conatif (faire agir). */
(function () {
  const MS = window.MS;

  MS.TYPES = {
    bold: { head: 'unbounded', w: 800, upper: true, italic: 'serif', body: 'hanken', bw: 600 },
    grot: { head: 'bricolage', w: 800, upper: false, track: -0.03, italic: 'serif', body: 'hanken', bw: 500 },
    edito: { head: 'fraunces', w: 600, upper: false, track: -0.02, italic: 'fraunces', itScale: 1.04, body: 'hanken', bw: 500 },
    ether: { head: 'hanken', w: 300, upper: false, track: -0.04, italic: 'serif', body: 'hanken', bw: 400 },
    mono: { head: 'mono', w: 700, upper: true, track: -0.02, italic: 'serif', body: 'mono', bw: 700 },
    serif: { head: 'serif', w: 400, upper: false, italic: 'serif', itScale: 1, body: 'hanken', bw: 500 },
  };

  MS.PALETTES = {
    citron: { name: 'Citron', bg: '#FFE14D', ink: '#141414', accent: '#3A2BFF', soft: '#FFF3A8' },
    nuit: { name: 'Nuit', bg: '#1A1740', ink: '#FFF4E6', accent: '#FF6FB5', soft: '#6B5CFF' },
    menthe: { name: 'Menthe', bg: '#D6F5E3', ink: '#0F3D2E', accent: '#FF6A3D', soft: '#A6E8C4' },
    lagon: { name: 'Lagon', bg: '#0B4F6C', ink: '#F2FBFF', accent: '#FFD23F', soft: '#1D7EA3' },
    ether: { name: 'Éther', bg: '#FFFFFF', ink: '#3E3350', accent: '#F4B6CF', soft: '#CDB8E8' },
    aube: { name: 'Aube', bg: '#F6E7F0', ink: '#3E3350', accent: '#B77BD9', soft: '#F9C9D9' },
    lilas: { name: 'Lilas', bg: '#E9E1F6', ink: '#2E2640', accent: '#7B5CFF', soft: '#F7C6DD' },
    corail: { name: 'Corail', bg: '#FF6B5B', ink: '#1F1530', accent: '#FFE8D6', soft: '#FF9F8F' },
    encre: { name: 'Encre', bg: '#0E0E12', ink: '#F4F1FA', accent: '#8FB8FF', soft: '#262634' },
    papier: { name: 'Papier', bg: '#F5F1E8', ink: '#1C1C1C', accent: '#2F6BFF', soft: '#E8DFC9' },
    foret: { name: 'Forêt', bg: '#12352A', ink: '#F1F7EE', accent: '#E8C547', soft: '#2C5E4A' },
    bonbon: { name: 'Bonbon', bg: '#FFC8DD', ink: '#2B1A3D', accent: '#7B2FF7', soft: '#BDE0FE' },
    tech: { name: 'Tech', bg: '#0A0F2C', ink: '#E6F0FF', accent: '#29E0C8', soft: '#3346FF' },
    sable: { name: 'Sable', bg: '#EAD7C3', ink: '#3B2A1E', accent: '#B5543C', soft: '#F5E9DC' },
    rouge: { name: 'Rouge', bg: '#E3262F', ink: '#FFFFFF', accent: '#FFD84D', soft: '#B01820' },
    ocean: { name: 'Océan', bg: '#DDEBFF', ink: '#0B2545', accent: '#FF5C8A', soft: '#A9C9FF' },
  };

  MS.OBJECTIVES = {
    cognitif: { name: 'Cognitif', verb: 'comprendre', desc: 'Faire savoir et faire comprendre : chiffres, étapes, comparaisons, explications.' },
    affectif: { name: 'Affectif', verb: 'ressentir', desc: "Faire aimer : émotion, image de marque, remerciements, récits." },
    conatif: { name: 'Conatif', verb: 'agir', desc: "Faire agir : acheter, s'inscrire, télécharger, partager, maintenant." },
  };

  const S = (type, t0, t1, p = {}) => Object.assign({ type, t0, t1 }, p);
  const L = [];
  function T(o) {
    o.p = Object.assign({}, MS.PALETTES[o.pal]);
    o.fields = Object.entries(o.f).map(([k, v]) => ({ k, label: v[0], v: v[1], max: v[2] || 60 }));
    o.format = o.format || '9:16';
    o.poster = o.poster != null ? o.poster : o.dur - 0.6;
    L.push(o);
  }

  // =================== COGNITIF ===================
  T({ id: 'chiffre-cle', name: 'Le chiffre clé', obj: 'cognitif', goal: 'Faire retenir une statistique', type: 'bold', pal: 'lilas', bg: { type: 'grid' }, kit: 'corporate', dur: 8,
    scenes: [
      S('tag', 0.2, 5.1, { text: '{tag}', y: 0.16, L: { y: 0.1 } }),
      S('counter', 0.4, 5.2, { value: '{n}', label: '{label}', ring: true, y: 0.44, L: { y: 0.42, size: 0.8 } }),
      S('shapes', 0.8, 5.2, { kind: 'dots', x: 0.84, y: 0.9, L: { x: 0.9, y: 0.82 } }),
      S('fill', 5.1, 8, { color: 'accent', how: 'split' }),
      S('title', 5.6, 8, { lines: ['{l1}', '{l2}'], style: 'wave', color: 'bg', y: 0.45, out: 'none' }),
      S('caption', 6.4, 8, { text: '{source}', y: 0.64, size: 32, color: 'bg', alpha: 0.8, out: 'none', L: { y: 0.72 } }),
    ],
    f: { tag: ['Étiquette', 'Étude 2026', 24], n: ['Chiffre', '73%', 8], label: ['Explication', "des clients lisent les avis avant d'acheter", 70], l1: ['Question, ligne 1', 'Et vous,', 16], l2: ['Question, ligne 2', 'vous *les lisez* ?', 18], source: ['Source', 'Source : baromètre consommateurs', 50] } });

  T({ id: 'explainer', name: 'Explainer en 3 étapes', obj: 'cognitif', goal: 'Expliquer un fonctionnement', type: 'grot', pal: 'ocean', bg: { type: 'dots' }, kit: 'corporate', dur: 10,
    scenes: [
      S('title', 0.2, 3, { lines: ['{q1}', '{q2}'], style: 'rise', colors: ['ink', 'accent'], y: 0.45, size: 1.2 }),
      S('shapes', 0.6, 3, { kind: 'squiggle', x: 0.5, y: 0.6, color: 'accent', L: { y: 0.68 } }),
      S('title', 3, 10, { lines: ['{h}'], size: 0.5, y: 0.2, style: 'fade', out: 'none', L: { y: 0.14 } }),
      S('steps', 3.1, 8.4, { items: '{s1}|{s2}|{s3}', y: 0.52, stagger: 0.45, L: { y: 0.56 } }),
      S('caption', 8.4, 10, { text: '{end}', y: 0.52, size: 60, weight: 700, out: 'none' }),
    ],
    f: { q1: ['Question, ligne 1', 'Comment ça', 16], q2: ['Question, ligne 2', '*marche* ?', 16], h: ['Intertitre', 'En 3 étapes', 22], s1: ['Étape 1', 'Choisis ton template', 34], s2: ['Étape 2', 'Change les textes', 34], s3: ['Étape 3', 'Exporte ta vidéo', 34], end: ['Conclusion', "C'est *aussi simple* que ça.", 50] } });

  T({ id: 'le-saviez-vous', name: 'Le saviez-vous ?', obj: 'cognitif', goal: 'Partager un fait surprenant', type: 'mono', pal: 'papier', bg: { type: 'paper' }, kit: 'chill', dur: 9,
    scenes: [
      S('tag', 0.2, 9, { text: '{tag}', y: 0.16, out: 'none', color: 'accent', text2: 'bg', L: { y: 0.1 } }),
      S('title', 0.5, 5, { lines: ['{f1}', '{f2}', '{f3}'], style: 'type', size: 0.7, y: 0.44, rate: 0.06 }),
      S('counter', 5, 9, { value: '{n}', label: '{label}', y: 0.44, out: 'none', size: 1.2, L: { y: 0.42 } }),
    ],
    f: { tag: ['Étiquette', 'Le saviez-vous ?', 24], f1: ['Fait, ligne 1', 'Une pieuvre', 16], f2: ['Fait, ligne 2', 'possède', 16], f3: ['Fait, ligne 3', 'trois cœurs.', 16], n: ['Chiffre', '3', 6], label: ['Précision', 'et son sang est *bleu*.', 50] } });

  T({ id: 'infographie', name: 'Infographie en barres', obj: 'cognitif', goal: 'Comparer des valeurs', type: 'grot', pal: 'tech', bg: { type: 'grid' }, kit: 'tech', dur: 9,
    scenes: [
      S('title', 0.2, 9, { lines: ['{t}'], style: 'split', size: 0.62, y: 0.16, out: 'none', L: { y: 0.12 } }),
      S('bars', 0.9, 9, { items: '{b}', y: 0.54, out: 'none' }),
      S('caption', 5.5, 9, { text: '{note}', y: 0.88, size: 30, alpha: 0.7, out: 'none', L: { y: 0.93 } }),
    ],
    f: { t: ['Titre', 'Temps passé *par jour*', 28], b: ['Barres (Nom:Valeur | …)', 'TikTok:95 min|YouTube:74 min|Instagram:62 min|Facebook:31 min', 120], note: ['Note', 'Moyenne 18-24 ans, chiffres illustratifs', 60] } });

  T({ id: 'avant-apres', name: 'Avant / Après', obj: 'cognitif', goal: 'Montrer un bénéfice concret', type: 'grot', pal: 'menthe', bg: { type: 'solid' }, kit: 'pop', dur: 8,
    scenes: [
      S('title', 0.1, 2.4, { lines: ['{t1}', '{t2}'], style: 'scale', y: 0.5, colors: ['ink', 'accent'] }),
      S('compare', 2.3, 8, { la: '{la}', a: '{a}', lb: '{lb}', b: '{b}', out: 'none' }),
    ],
    f: { t1: ['Titre, ligne 1', 'La même tâche,', 18], t2: ['Titre, ligne 2', '*deux* mondes', 18], la: ['Étiquette gauche', 'Avant', 14], a: ['Texte gauche (| = retour)', '3 heures|de montage', 30], lb: ['Étiquette droite', 'Après', 14], b: ['Texte droite (| = retour)', '3 minutes|avec Lueur', 30] } });

  T({ id: 'chronologie', name: 'Chronologie', obj: 'cognitif', goal: 'Raconter des étapes dans le temps', type: 'edito', pal: 'sable', bg: { type: 'solid' }, grain: 0.08, kit: 'chill', dur: 10,
    scenes: [
      S('title', 0.2, 10, { lines: ['{t}'], style: 'fade', size: 0.62, y: 0.12, out: 'none' }),
      S('timeline', 0.8, 10, { items: '{items}', out: 'none' }),
    ],
    f: { t: ['Titre', 'Notre *histoire*', 26], items: ['Dates (Année:Texte | …)', "2016:Un atelier de 12 m²|2019:La première boutique|2022:5 000 clients fidèles|2026:Une nouvelle collection", 160] } });

  T({ id: 'definition', name: 'Définition', obj: 'cognitif', goal: 'Expliquer un mot ou un concept', type: 'serif', pal: 'papier', bg: { type: 'paper' }, kit: 'chill', dur: 8,
    scenes: [
      S('title', 0.2, 8, { lines: ['{mot}'], style: 'track', size: 1.3, y: 0.36, out: 'none', L: { y: 0.3 } }),
      S('caption', 1.2, 8, { text: '{phon}', y: 0.46, size: 32, font: 'mono', weight: 700, alpha: 0.6, out: 'none', L: { y: 0.46 } }),
      S('shapes', 1.4, 8, { kind: 'lines', x: 0.64, y: 0.52, color: 'accent', out: 'none', L: { hide: true } }),
      S('caption', 1.8, 8, { text: '{def}', y: 0.64, size: 56, serif: true, out: 'none', L: { y: 0.68, size: 50 } }),
    ],
    f: { mot: ['Mot', 'Conatif', 16], phon: ['Prononciation', '[kɔ.na.tif] · adjectif', 36], def: ['Définition', "Qui pousse à *passer à l'action* : acheter, s'inscrire, cliquer, partager.", 110] } });

  T({ id: 'nouvelle-fonction', name: 'Nouvelle fonctionnalité', obj: 'cognitif', goal: 'Présenter une nouveauté produit', type: 'grot', pal: 'ocean', bg: { type: 'mesh' }, kit: 'tech', dur: 9,
    scenes: [
      S('tag', 0.2, 4.3, { text: '{tag}', y: 0.1, L: { y: 0.08 } }),
      S('phone', 0.3, 4.4, { app: '{app}', notif: '{notif}', y: 0.56 }),
      S('title', 4.3, 9, { lines: ['{l1}', '{l2}'], style: 'rise', y: 0.3, colors: ['ink', 'accent'], out: 'none', L: { y: 0.26, size: 0.9 } }),
      S('checklist', 5, 9, { items: '{items}', y: 0.64, out: 'none', L: { y: 0.66 } }),
    ],
    f: { tag: ['Étiquette', 'Nouveau', 18], app: ["Nom de l'app", 'Lueur', 16], notif: ['Notification', 'Ta vidéo est prête ! Export MP4 terminé.', 60], l1: ['Titre, ligne 1', 'Export', 16], l2: ['Titre, ligne 2', '*en un clic*', 18], items: ['Points (| entre chaque)', 'Format vertical et carré|Son inclus|Sans inscription', 100] } });

  T({ id: 'donut', name: 'Pourcentage', obj: 'cognitif', goal: 'Rendre une proportion visible', type: 'grot', pal: 'lilas', bg: { type: 'solid' }, kit: 'corporate', dur: 8,
    scenes: [
      S('title', 0.2, 8, { lines: ['{t}'], size: 0.6, y: 0.14, style: 'rise', out: 'none', L: { y: 0.1 } }),
      S('donut', 0.6, 8, { value: '{n}', label: '{label}', y: 0.44, out: 'none', L: { y: 0.42 } }),
      S('shapes', 1, 8, { kind: 'plus', color: 'accent', alpha: 0.7, out: 'none' }),
    ],
    f: { t: ['Titre', 'Satisfaction client', 26], n: ['Pourcentage', '94%', 6], label: ['Explication', 'recommandent *notre service* à un proche', 60] } });

  T({ id: 'evenement', name: 'Annonce événement', obj: 'cognitif', goal: 'Informer d’une date et d’un lieu', type: 'bold', pal: 'nuit', bg: { type: 'aurora' }, vignette: 0.3, kit: 'cinema', dur: 9,
    scenes: [
      S('shapes', 1, 9, { kind: 'ring', x: 0.84, y: 0.1, color: 'accent', size: 0.8, out: 'none', L: { x: 0.9, y: 0.16 } }),
      S('tag', 0.3, 9, { text: '{date}', y: 0.24, outline: true, color: 'ink', out: 'none', L: { y: 0.14 } }),
      S('title', 0.6, 9, { lines: ['{l1}', '{l2}', '{l3}'], style: 'blur', y: 0.46, colors: ['ink', 'accent', 'ink'], out: 'none', stagger: 0.25 }),
      S('caption', 2.2, 9, { text: '{lieu}', y: 0.7, size: 38, weight: 700, upper: true, track: 0.12, out: 'none', L: { y: 0.84 } }),
    ],
    f: { date: ['Date', '14 novembre · 19h', 28], l1: ['Titre, ligne 1', 'La grande', 16], l2: ['Titre, ligne 2', '*soirée*', 16], l3: ['Titre, ligne 3', 'de lancement', 16], lieu: ['Lieu', 'Paris · Pavillon Baltard', 40] } });

  T({ id: 'tuto', name: 'Tuto rapide', obj: 'cognitif', goal: 'Donner des conseils pratiques', type: 'bold', pal: 'bonbon', bg: { type: 'stripes' }, kit: 'pop', dur: 9,
    scenes: [
      S('words', 0.1, 3.2, { text: '{w}', colors: ['ink', 'accent'], tilt: 0.05 }),
      S('title', 3.2, 9, { lines: ['{h}'], size: 0.55, y: 0.16, style: 'wave', out: 'none', L: { y: 0.12 } }),
      S('steps', 3.5, 9, { items: '{s}', y: 0.55, out: 'none', stagger: 0.5 }),
    ],
    f: { w: ['Phrase mot à mot', '3 astuces pour des vidéos qui retiennent', 60], h: ['Intertitre', 'À retenir', 20], s: ['Étapes (| entre chaque)', 'Une idée par écran|Cinq mots maximum|Le son souligne le geste', 110] } });

  T({ id: 'faq', name: 'Question fréquente', obj: 'cognitif', goal: 'Répondre à une objection', type: 'grot', pal: 'aube', bg: { type: 'mesh' }, kit: 'ethere', dur: 9,
    scenes: [
      S('tag', 0.2, 9, { text: '{tag}', y: 0.2, out: 'none', color: 'accent', text2: 'bg', L: { y: 0.14 } }),
      S('title', 0.4, 9, { lines: ['{q1}', '{q2}'], style: 'type', size: 1, y: 0.37, rate: 0.05, out: 'none', L: { y: 0.36 } }),
      S('caption', 2.4, 9, { text: '{a}', y: 0.64, size: 46, out: 'none', L: { y: 0.72 } }),
    ],
    f: { tag: ['Étiquette', 'Question fréquente', 26], q1: ['Question, ligne 1', 'Faut-il une', 16], q2: ['Question, ligne 2', '*clé API* ?', 16], a: ['Réponse', 'Non. Tout est calculé dans ton navigateur : les images, l’animation et le son.', 110] } });

  T({ id: 'lancement', name: 'Lancement produit', obj: 'cognitif', goal: 'Présenter un produit et ses atouts', type: 'edito', pal: 'encre', bg: { type: 'solid' }, grain: 0.1, vignette: 0.35, kit: 'cinema', dur: 10,
    scenes: [
      S('logo', 0.2, 4.2, { text: '{brand}', sub: '{tagline}', dot: 'accent' }),
      S('fill', 4.1, 10, { color: 'soft', how: 'blinds' }),
      S('title', 4.6, 10, { lines: ['{l1}', '{l2}'], style: 'rise', y: 0.3, colors: ['ink', 'accent'], out: 'none', L: { y: 0.24, size: 0.9 } }),
      S('checklist', 5.4, 10, { items: '{items}', y: 0.64, out: 'none', L: { y: 0.66 } }),
    ],
    f: { brand: ['Marque', 'Orbite', 16], tagline: ['Signature', 'Écouteurs sans fil', 30], l1: ['Titre, ligne 1', 'Le silence,', 18], l2: ['Titre, ligne 2', '*réinventé*', 18], items: ['Atouts (| entre chaque)', "40 h d'autonomie|Réduction de bruit active|Recharge en 10 minutes", 110] } });

  T({ id: 'rafale', name: 'Chiffres en rafale', obj: 'cognitif', goal: 'Faire mémoriser plusieurs chiffres', type: 'bold', pal: 'rouge', bg: { type: 'solid' }, kit: 'punch', dur: 7,
    scenes: [
      S('words', 0, 5.2, { text: '{w}', sep: '•', flash: true, bgs: ['bg', 'ink', 'accent'], colors: ['ink', 'bg', 'bg'] }),
      S('fill', 5.1, 7, { color: 'ink', how: 'iris' }),
      S('title', 5.4, 7, { lines: ['{l1}', '{l2}'], color: 'bg', colors: ['bg', 'bg'], style: 'scale', y: 0.5, out: 'none' }),
    ],
    f: { w: ['Chiffres (• entre chaque)', '+120 % • 3 000 clients • 24 h/24 • 0 € de frais • 1 appli', 90], l1: ['Titre, ligne 1', 'Les chiffres', 16], l2: ['Titre, ligne 2', '*parlent*', 16] } });

  T({ id: 'retenir', name: "Ce qu'il faut retenir", obj: 'cognitif', goal: 'Résumer en points clés', type: 'grot', pal: 'menthe', bg: { type: 'dots' }, kit: 'corporate', dur: 9,
    scenes: [
      S('title', 0.2, 9, { lines: ['{t1}', '{t2}'], size: 0.7, y: 0.2, style: 'rise', colors: ['ink', 'accent'], out: 'none', L: { y: 0.18 } }),
      S('checklist', 0.9, 9, { items: '{items}', y: 0.58, stagger: 0.55, out: 'none', L: { y: 0.62 } }),
    ],
    f: { t1: ['Titre, ligne 1', "Ce qu'il faut", 18], t2: ['Titre, ligne 2', '*retenir*', 18], items: ['Points (| entre chaque)', 'Huit secondes suffisent|Une phrase, une idée|Le bouton dit quoi faire|Le son guide le regard', 140] } });

  T({ id: 'clarte', name: 'Sphère de clarté', obj: 'cognitif', goal: 'Expliquer avec douceur', type: 'ether', pal: 'ether', bg: { type: 'image', src: 'sphere', zoom: 1.12, py: 0.42 }, kit: 'ethere', dur: 9,
    scenes: [
      S('bubbles', 0, 9, { count: 10, out: 'none' }),
      S('glass', 0.5, 9, { eyebrow: '{eye}', title: '{title}', sub: '{sub}', y: 0.74, out: 'none', L: { y: 0.62, size: 0.8 } }),
    ],
    f: { eye: ['Surtitre', 'Comprendre', 24], title: ['Titre', 'Tout devient *limpide* en huit secondes.', 60], sub: ['Texte', "Une idée, un geste, une image : on retient ce qu'on voit bouger.", 100] } });

  T({ id: 'mythe', name: 'Mythe ou réalité', obj: 'cognitif', goal: 'Corriger une idée reçue', type: 'bold', pal: 'corail', bg: { type: 'solid' }, kit: 'pop', dur: 8,
    scenes: [
      S('title', 0.1, 2.2, { lines: ['{t1}', '{t2}'], style: 'scale', y: 0.5, colors: ['ink', 'accent'] }),
      S('compare', 2.1, 8, { la: '{la}', a: '{m}', lb: '{lb}', b: '{r}', ca: 'ink', ta: 'bg', cb: 'accent', tb: 'ink', out: 'none' }),
    ],
    f: { t1: ['Titre, ligne 1', 'Mythe', 14], t2: ['Titre, ligne 2', 'ou *réalité* ?', 16], la: ['Étiquette gauche', 'Mythe', 14], m: ['Idée reçue (| = retour)', 'Il faut|un gros budget', 30], lb: ['Étiquette droite', 'Réalité', 14], r: ['Réalité (| = retour)', 'Un navigateur|suffit', 30] } });

  // =================== AFFECTIF ===================
  T({ id: 'manifeste', name: 'Manifeste', obj: 'affectif', goal: 'Affirmer une vision', type: 'edito', pal: 'encre', bg: { type: 'solid' }, grain: 0.12, vignette: 0.4, kit: 'cinema', dur: 10,
    scenes: [
      S('words', 0.2, 5.2, { text: '{w}', colors: ['ink', 'ink', 'accent'], size: 0.8 }),
      S('title', 5.2, 10, { lines: ['{l1}', '{l2}'], style: 'track', y: 0.46, colors: ['ink', 'accent'], out: 'none', size: 1.1 }),
      S('caption', 6.6, 10, { text: '{sign}', y: 0.64, size: 30, upper: true, track: 0.2, alpha: 0.7, weight: 600, out: 'none', L: { y: 0.72 } }),
    ],
    f: { w: ['Phrase mot à mot', 'On ne vend pas des produits. On raconte des histoires.', 70], l1: ['Titre, ligne 1', 'Faites-le', 16], l2: ['Titre, ligne 2', '*avec cœur*', 16], sign: ['Signature', 'Maison Lueur · depuis 2016', 40] } });

  T({ id: 'temoignage', name: 'Témoignage', obj: 'affectif', goal: 'Rassurer par la preuve sociale', type: 'serif', pal: 'aube', bg: { type: 'mesh' }, kit: 'ethere', dur: 9,
    scenes: [
      S('quote', 0.2, 9, { text: '{q}', author: '{who}', stars: 5, y: 0.48, out: 'none', L: { size: 62 } }),
    ],
    f: { q: ['Citation', "J'ai enfin des vidéos qui *me ressemblent*, et mes clients le sentent.", 130], who: ['Auteur', 'Camille, fleuriste à Lyon', 40] } });

  T({ id: 'merci', name: 'Merci', obj: 'affectif', goal: 'Remercier sa communauté', type: 'grot', pal: 'bonbon', bg: { type: 'solid' }, kit: 'pop', dur: 8,
    scenes: [
      S('hearts', 0, 8, { count: 22, out: 'none' }),
      S('title', 0.3, 8, { lines: ['{l1}', '{l2}'], style: 'wave', y: 0.44, colors: ['ink', 'accent'], size: 1.25, out: 'none', L: { y: 0.42 } }),
      S('caption', 1.8, 8, { text: '{sub}', y: 0.62, size: 44, out: 'none', L: { y: 0.72 } }),
    ],
    f: { l1: ['Titre, ligne 1', 'Merci', 14], l2: ['Titre, ligne 2', '*à vous*', 14], sub: ['Texte', "10 000 abonnés. On n'en revient toujours pas.", 80] } });

  T({ id: 'signature', name: 'Logo signature', obj: 'affectif', goal: 'Installer une marque', type: 'bold', pal: 'nuit', bg: { type: 'solid' }, vignette: 0.3, kit: 'cinema', dur: 7,
    scenes: [
      S('shapes', 0.2, 7, { kind: 'arcs', x: 0.5, y: 0.47, color: 'accent', alpha: 0.35, size: 2.2, out: 'none' }),
      S('logo', 0.3, 7, { text: '{brand}', sub: '{tagline}', out: 'none' }),
    ],
    f: { brand: ['Marque', 'Nébuleuse', 16], tagline: ['Signature', 'Studio créatif', 30] } });

  T({ id: 'ethere', name: 'Éthéré', obj: 'affectif', goal: 'Créer une atmosphère de marque', type: 'ether', pal: 'ether', bg: { type: 'image', src: 'hero', zoom: 1.16, px: 0.44 }, kit: 'ethere', dur: 10,
    scenes: [
      S('bubbles', 0, 10, { count: 14, out: 'none' }),
      S('glass', 0.6, 10, { eyebrow: '{eye}', title: '{title}', sub: '{sub}', btn: '{btn}', y: 0.5, bare: true, out: 'none', size: 1.1 }),
    ],
    f: { eye: ['Surtitre', 'Rituel · Algue marine', 30], title: ['Titre', 'La seule routine dont vous aurez *vraiment* besoin.', 70], sub: ['Texte', 'Deux super-aliments, un seul geste chaque matin.', 80], btn: ['Bouton', 'Découvrir', 18] } });

  T({ id: 'magnolia', name: 'Magnolia', obj: 'affectif', goal: 'Évoquer la douceur', type: 'ether', pal: 'ether', bg: { type: 'image', src: 'magnolia', zoom: 1.12, py: 0.55 }, kit: 'ethere', dur: 9,
    scenes: [
      S('bubbles', 0, 9, { count: 8, out: 'none' }),
      S('title', 0.6, 9, { lines: ['{l1}', '{l2}'], style: 'blur', y: 0.17, color: 'ink', size: 1.15, out: 'none', stagger: 0.35, L: { y: 0.2 } }),
      S('caption', 2.2, 9, { text: '{sub}', y: 0.88, size: 38, weight: 500, out: 'none' }),
    ],
    f: { l1: ['Titre, ligne 1', 'Offrez-vous', 16], l2: ['Titre, ligne 2', 'un *instant doux*', 18], sub: ['Texte', 'Collection printemps · éditions limitées', 60] } });

  T({ id: 'anniversaire', name: 'Anniversaire de marque', obj: 'affectif', goal: 'Célébrer un cap', type: 'bold', pal: 'citron', bg: { type: 'rays' }, kit: 'pop', dur: 9,
    scenes: [
      S('counter', 0.2, 4.2, { value: '{n}', label: '{label}', y: 0.42, color: 'accent', size: 1.3 }),
      S('confetti', 3.6, 9, { y: 0.55, out: 'none' }),
      S('title', 4.2, 9, { lines: ['{l1}', '{l2}'], style: 'wave', y: 0.44, colors: ['ink', 'accent'], out: 'none' }),
      S('caption', 5.4, 9, { text: '{sub}', y: 0.62, size: 44, weight: 600, out: 'none', L: { y: 0.72 } }),
    ],
    f: { n: ['Chiffre', '10 ans', 8], label: ['Sous le chiffre', "d'aventures", 30], l1: ['Titre, ligne 1', "Merci d'être", 16], l2: ['Titre, ligne 2', '*du voyage*', 16], sub: ['Texte', "Et ce n'est que le début.", 60] } });

  T({ id: 'citation', name: 'Citation inspirante', obj: 'affectif', goal: 'Inspirer', type: 'serif', pal: 'aube', bg: { type: 'sky' }, kit: 'ethere', dur: 9,
    scenes: [
      S('bubbles', 0, 9, { count: 6, out: 'none' }),
      S('quote', 0.3, 9, { text: '{q}', author: '{who}', y: 0.48, size: 80, out: 'none', L: { size: 64 } }),
    ],
    f: { q: ['Citation', "Ce qui se *ressent* se retient toujours mieux que ce qui s'explique.", 130], who: ['Auteur', 'Proverbe de studio', 40] } });

  T({ id: 'valeurs', name: 'Nos valeurs', obj: 'affectif', goal: 'Partager ses valeurs', type: 'grot', pal: 'foret', bg: { type: 'solid' }, grain: 0.06, kit: 'corporate', dur: 9,
    scenes: [
      S('title', 0.2, 2.6, { lines: ['{t}'], style: 'rise', y: 0.46, size: 0.8 }),
      S('words', 2.6, 6.8, { text: '{w}', colors: ['accent', 'ink'], size: 0.9 }),
      S('caption', 6.8, 9, { text: '{sub}', y: 0.5, size: 54, weight: 600, out: 'none' }),
    ],
    f: { t: ['Titre', 'Ce qui *nous guide*', 24], w: ['Valeurs (espace entre chaque)', 'Honnêteté Patience Artisanat', 50], sub: ['Conclusion', 'Trois mots, *une seule* façon de travailler.', 60] } });

  T({ id: 'bienvenue', name: 'Bienvenue', obj: 'affectif', goal: 'Accueillir chaleureusement', type: 'grot', pal: 'lilas', bg: { type: 'mesh' }, kit: 'ethere', dur: 8,
    scenes: [
      S('shapes', 0.2, 8, { kind: 'orbit', x: 0.5, y: 0.45, out: 'none', size: 1.1 }),
      S('title', 0.5, 8, { lines: ['{l1}', '{l2}'], style: 'wave', y: 0.45, colors: ['ink', 'accent'], out: 'none' }),
      S('caption', 2, 8, { text: '{sub}', y: 0.68, size: 44, out: 'none', L: { y: 0.76 } }),
    ],
    f: { l1: ['Titre, ligne 1', 'Bienvenue', 14], l2: ['Titre, ligne 2', '*chez nous*', 16], sub: ['Texte', "Installe-toi, on s'occupe du reste.", 60] } });

  T({ id: 'coulisses', name: 'Coulisses', obj: 'affectif', goal: 'Montrer le savoir-faire', type: 'bold', pal: 'sable', bg: { type: 'solid' }, grain: 0.1, kit: 'chill', dur: 9,
    scenes: [
      S('marquee', 0, 4.2, { text: '{m}', rows: 5, y: 0.5 }),
      S('fill', 4.1, 9, { color: 'ink', how: 'slide' }),
      S('title', 4.5, 9, { lines: ['{l1}', '{l2}'], style: 'rise', colors: ['bg', 'soft'], y: 0.44, out: 'none' }),
      S('caption', 5.6, 9, { text: '{sub}', y: 0.62, size: 42, color: 'bg', out: 'none', L: { y: 0.7 } }),
    ],
    f: { m: ['Bandeau', 'Coulisses', 16], l1: ['Titre, ligne 1', 'Fait main,', 16], l2: ['Titre, ligne 2', '*pièce par pièce*', 20], sub: ['Texte', "Visite de l'atelier, de la découpe à l'emballage.", 80] } });

  T({ id: 'storytelling', name: 'Storytelling', obj: 'affectif', goal: 'Raconter une histoire courte', type: 'mono', pal: 'papier', bg: { type: 'paper' }, kit: 'chill', dur: 11,
    scenes: [
      S('title', 0.2, 3.4, { lines: ['{a1}', '{b1}'], style: 'type', size: 0.7, y: 0.45 }),
      S('title', 3.4, 6.8, { lines: ['{a2}', '{b2}'], style: 'type', size: 0.7, y: 0.45 }),
      S('title', 6.8, 11, { lines: ['{a3}', '{b3}'], style: 'type', size: 0.9, y: 0.42, out: 'none' }),
      S('caption', 8.6, 11, { text: '{sign}', y: 0.6, size: 38, weight: 400, out: 'none', L: { y: 0.66 } }),
    ],
    f: { a1: ['Phrase 1, ligne 1', 'Il y a 5 ans,', 16], b1: ['Phrase 1, ligne 2', 'une idée.', 16], a2: ['Phrase 2, ligne 1', 'Puis une table,', 16], b2: ['Phrase 2, ligne 2', 'deux chaises.', 16], a3: ['Phrase 3, ligne 1', "Aujourd'hui,", 16], b3: ['Phrase 3, ligne 2', '*vous*.', 16], sign: ['Signature', "Merci de faire partie de l'histoire.", 60] } });

  T({ id: 'aurora', name: 'Aurora', obj: 'affectif', goal: 'Faire rêver', type: 'ether', pal: 'nuit', bg: { type: 'aurora' }, vignette: 0.3, kit: 'cinema', dur: 9,
    scenes: [
      S('bubbles', 1, 9, { count: 6, out: 'none' }),
      S('title', 0.4, 9, { lines: ['{l1}', '{l2}'], style: 'blur', y: 0.45, size: 1.3, colors: ['ink', 'accent'], stagger: 0.4, out: 'none' }),
      S('caption', 2.4, 9, { text: '{sub}', y: 0.63, size: 40, alpha: 0.8, out: 'none', L: { y: 0.72 } }),
    ],
    f: { l1: ['Titre, ligne 1', 'Rêvez', 14], l2: ['Titre, ligne 2', '*plus grand*', 16], sub: ['Texte', 'Le nouveau parfum de la nuit.', 60] } });

  T({ id: 'fete', name: 'Célébration', obj: 'affectif', goal: 'Partager une joie', type: 'bold', pal: 'corail', bg: { type: 'solid' }, kit: 'punch', dur: 7,
    scenes: [
      S('words', 0, 3.6, { text: '{w}', sep: '•', flash: true, bgs: ['bg', 'accent', 'ink'], colors: ['ink', 'ink', 'bg'], size: 1.1 }),
      S('confetti', 3.5, 7, { y: 0.6 }),
      S('title', 3.6, 7, { lines: ['{l1}', '{l2}'], style: 'scale', y: 0.46, colors: ['ink', 'accent'], out: 'none' }),
    ],
    f: { w: ['Mots (• entre chaque)', 'On • fête • ça !', 40], l1: ['Titre, ligne 1', '5 ans', 14], l2: ['Titre, ligne 2', '*ensemble*', 16] } });

  T({ id: 'communaute', name: 'Communauté', obj: 'affectif', goal: 'Valoriser sa communauté', type: 'grot', pal: 'ocean', bg: { type: 'solid' }, kit: 'pop', dur: 8,
    scenes: [
      S('counter', 0.2, 4.4, { value: '{n}', label: '{label}', y: 0.44, size: 1.2 }),
      S('hearts', 1.5, 8, { count: 16, out: 'none' }),
      S('title', 4.4, 8, { lines: ['{l1}', '{l2}'], style: 'wave', y: 0.46, colors: ['ink', 'accent'], out: 'none' }),
    ],
    f: { n: ['Chiffre', '50 000', 10], label: ['Sous le chiffre', 'membres dans la communauté', 50], l1: ['Titre, ligne 1', 'Merci', 14], l2: ['Titre, ligne 2', "d'être *là*", 16] } });

  T({ id: 'escalier', name: 'Chaque pas compte', obj: 'affectif', goal: 'Motiver', type: 'ether', pal: 'ether', bg: { type: 'image', src: 'escalier', zoom: 1.12, py: 0.6 }, kit: 'ethere', dur: 9,
    scenes: [
      S('title', 0.6, 9, { lines: ['{l1}', '{l2}'], style: 'blur', y: 0.14, color: 'ink', size: 1.1, stagger: 0.3, out: 'none', L: { y: 0.18 } }),
      S('caption', 2.2, 9, { text: '{sub}', y: 0.9, size: 36, color: 'bg', weight: 500, out: 'none' }),
    ],
    f: { l1: ['Titre, ligne 1', 'Chaque pas', 16], l2: ['Titre, ligne 2', '*compte*', 16], sub: ['Texte', "Commencez aujourd'hui. Le reste suivra.", 60] } });

  T({ id: 'saison', name: 'Nouvelle saison', obj: 'affectif', goal: 'Annoncer une ambiance', type: 'serif', pal: 'sable', bg: { type: 'sky' }, kit: 'chill', dur: 8,
    scenes: [
      S('bubbles', 0, 8, { count: 6, out: 'none' }),
      S('title', 0.3, 8, { lines: ['{l1}', '{l2}'], style: 'fade', y: 0.4, size: 1.4, colors: ['ink', 'accent'], out: 'none', stagger: 0.3 }),
      S('caption', 1.6, 8, { text: '{sub}', y: 0.6, size: 42, out: 'none', L: { y: 0.68 } }),
      S('tag', 2.4, 8, { text: '{tag}', y: 0.72, out: 'none', L: { y: 0.84 } }),
    ],
    f: { l1: ['Titre, ligne 1', "L'automne", 16], l2: ['Titre, ligne 2', '*est là*', 16], sub: ['Texte', 'Laines douces, couleurs de terre.', 60], tag: ['Étiquette', 'Collection 2026', 24] } });

  // =================== CONATIF ===================
  T({ id: 'impact', name: 'Impact', obj: 'conatif', goal: 'Vendre une promotion', type: 'bold', pal: 'citron', bg: { type: 'solid' }, kit: 'punch', dur: 8,
    scenes: [
      S('fill', 0, 0.9, { color: 'accent', how: 'cut' }),
      S('fill', 0.05, 0.9, { color: 'bg', how: 'iris', dur: 0.8 }),
      S('shapes', 0.4, 4.95, { kind: 'ring', x: 0.84, y: 0.12, L: { x: 0.9, y: 0.16 } }),
      S('shapes', 0.9, 3.1, { kind: 'dots', x: 0.8, y: 0.8, L: { x: 0.88 } }),
      S('tag', 0.55, 2.95, { text: '{tag}', y: 0.33, align: 'left', L: { y: 0.22 } }),
      S('title', 0.75, 3.2, { lines: ['{l1}', '{l2}'], colors: ['ink', 'accent'], align: 'left', y: 0.47 }),
      S('burst', 2.95, 4.95, { text: '{n}', sub: '{sub}', y: 0.42, L: { y: 0.4 } }),
      S('fill', 4.9, 8, { color: 'ink', how: 'diag', lead: 'accent' }),
      S('title', 5.4, 8, { lines: ['{l1}', '{l2}'], style: 'wave', colors: ['bg', 'bg'], y: 0.36, size: 0.8, out: 'none', L: { y: 0.3 } }),
      S('cta', 6.0, 8, { text: '{cta}', url: '{url}', y: 0.58, btn: 'bg', btnText: 'ink', urlColor: 'bg', cursorFill: 'bg', cursorStroke: 'ink', out: 'none' }),
    ],
    f: { tag: ['Étiquette', 'Nouvelle collection', 24], l1: ['Titre, ligne 1', "L'été", 12], l2: ['Titre, ligne 2', 'est là', 12], n: ['Chiffre choc', '-40%', 6], sub: ['Phrase sous le chiffre', "Sur toute la boutique, jusqu'à dimanche minuit.", 70], cta: ['Bouton', 'Découvrir', 18], url: ['Site', 'maboutique.fr', 28] } });

  T({ id: 'compte-a-rebours', name: 'Compte à rebours', obj: 'conatif', goal: 'Créer l’urgence', type: 'bold', pal: 'rouge', bg: { type: 'stripes' }, kit: 'urgence', dur: 9,
    scenes: [
      S('tag', 0.2, 9, { text: '{tag}', y: 0.2, color: 'accent', text2: 'soft', out: 'none', L: { y: 0.09 } }),
      S('title', 0.3, 9, { lines: ['{l1}', '{l2}'], style: 'rise', y: 0.34, colors: ['ink', 'accent'], out: 'none', L: { y: 0.27, size: 0.8 } }),
      S('countdown', 0.8, 9, { from: '{from}', y: 0.58, box: 'ink', digit: 'bg', out: 'none', L: { y: 0.6 } }),
      S('cta', 5, 9, { text: '{cta}', y: 0.84, btn: 'accent', btnText: 'soft', size: 0.8, cursor: false, out: 'none', L: { y: 0.9 } }),
    ],
    f: { tag: ['Étiquette', 'Vente privée', 24], l1: ['Titre, ligne 1', 'Dernières', 14], l2: ['Titre, ligne 2', '*heures*', 14], from: ['Départ (HH:MM:SS)', '02:59:59', 8], cta: ['Bouton', "J'en profite", 18] } });

  T({ id: 'code-promo', name: 'Code promo', obj: 'conatif', goal: 'Faire utiliser un code', type: 'grot', pal: 'bonbon', bg: { type: 'dots' }, kit: 'pop', dur: 9,
    scenes: [
      S('title', 0.2, 9, { lines: ['{l1}', '{l2}'], style: 'wave', y: 0.24, colors: ['ink', 'accent'], out: 'none', L: { y: 0.2, size: 0.8 } }),
      S('code', 1.4, 9, { code: '{code}', label: '{label}', y: 0.52, out: 'none' }),
      S('cta', 4.6, 9, { text: '{cta}', url: '{url}', y: 0.76, out: 'none', L: { y: 0.8, size: 0.7 } }),
    ],
    f: { l1: ['Titre, ligne 1', 'Un petit', 14], l2: ['Titre, ligne 2', '*cadeau* ?', 14], code: ['Code', 'LUEUR20', 14], label: ['Au-dessus du code', '-20 % avec le code', 30], cta: ['Bouton', 'Commander', 18], url: ['Site', 'boutique-lueur.fr', 28] } });

  T({ id: 'prix-barre', name: 'Prix barré', obj: 'conatif', goal: 'Montrer une bonne affaire', type: 'bold', pal: 'menthe', bg: { type: 'solid' }, kit: 'punch', dur: 8,
    scenes: [
      S('tag', 0.2, 8, { text: '{tag}', y: 0.16, out: 'none', L: { y: 0.1 } }),
      S('price', 0.5, 8, { old: '{old}', now: '{now}', tag: '{pct}', y: 0.44, out: 'none', L: { y: 0.42 } }),
      S('caption', 2, 8, { text: '{sub}', y: 0.62, size: 42, out: 'none', L: { y: 0.7 } }),
      S('cta', 3, 8, { text: '{cta}', y: 0.8, out: 'none', L: { y: 0.87, size: 0.7 } }),
    ],
    f: { tag: ['Étiquette', 'Offre de lancement', 24], old: ['Ancien prix', '89 €', 10], now: ['Nouveau prix', '59 €', 10], pct: ['Pastille', '-34 %', 8], sub: ['Texte', 'Le sac en toile recyclée, livré en 48 h.', 70], cta: ['Bouton', 'Je le veux', 18] } });

  T({ id: 'app', name: "Télécharge l'app", obj: 'conatif', goal: 'Faire installer une application', type: 'grot', pal: 'tech', bg: { type: 'mesh' }, kit: 'tech', dur: 9,
    scenes: [
      S('phone', 0.2, 9, { app: '{app}', notif: '{notif}', y: 0.43, out: 'none', L: { x: 0.28, y: 0.5 } }),
      S('title', 3.2, 9, { lines: ['{l1}', '{l2}'], style: 'rise', y: 0.82, size: 0.62, colors: ['ink', 'accent'], out: 'none', L: { align: 'right', y: 0.4, size: 0.9 } }),
      S('cta', 4.4, 9, { text: '{cta}', y: 0.93, size: 0.6, cursor: false, out: 'none', L: { x: 0.72, y: 0.68, size: 0.8 } }),
    ],
    f: { app: ["Nom de l'app", 'Lueur', 16], notif: ['Notification', 'Nouveau template disponible : Aurora', 60], l1: ['Titre, ligne 1', 'Toute ta com’', 16], l2: ['Titre, ligne 2', '*dans ta poche*', 18], cta: ['Bouton', 'Télécharger', 18] } });

  T({ id: 'lien-bio', name: 'Lien en bio', obj: 'conatif', goal: 'Envoyer vers un lien', type: 'bold', pal: 'lilas', bg: { type: 'solid' }, kit: 'pop', dur: 7,
    scenes: [
      S('words', 0, 4, { text: '{w}', colors: ['ink', 'accent'] }),
      S('shapes', 4, 7, { kind: 'plus', color: 'accent', out: 'none' }),
      S('title', 4, 7, { lines: ['{l1}'], style: 'scale', y: 0.42, out: 'none' }),
      S('cta', 4.5, 7, { text: '{cta}', y: 0.58, out: 'none', L: { y: 0.64 } }),
    ],
    f: { w: ['Phrase mot à mot', 'Tout est dans le lien', 50], l1: ['Titre', 'Lien en *bio*', 18], cta: ['Bouton', 'Ouvrir le lien', 18] } });

  T({ id: 'webinar', name: 'Inscription webinar', obj: 'conatif', goal: 'Faire s’inscrire', type: 'grot', pal: 'ocean', bg: { type: 'grid' }, kit: 'corporate', dur: 10,
    scenes: [
      S('tag', 0.2, 10, { text: '{date}', y: 0.1, out: 'none', L: { y: 0.08 } }),
      S('title', 0.4, 10, { lines: ['{l1}', '{l2}'], style: 'rise', y: 0.24, colors: ['ink', 'accent'], out: 'none', L: { y: 0.25, size: 0.75 } }),
      S('checklist', 1.4, 10, { items: '{items}', y: 0.53, out: 'none', L: { y: 0.6 } }),
      S('cta', 5, 10, { text: '{cta}', url: '{url}', y: 0.82, out: 'none', L: { y: 0.9, size: 0.62, url: '' } }),
    ],
    f: { date: ['Date', 'Jeudi 12 · 18h30', 26], l1: ['Titre, ligne 1', 'Webinar', 14], l2: ['Titre, ligne 2', '*gratuit*', 14], items: ['Au programme (| entre chaque)', 'Écrire un script en 5 minutes|Choisir le bon rythme|Mesurer ce qui marche', 120], cta: ['Bouton', "Je m'inscris", 18], url: ['Lien', 'lueur.studio/live', 28] } });

  T({ id: 'flash-sale', name: 'Vente flash', obj: 'conatif', goal: 'Déclencher un achat impulsif', type: 'bold', pal: 'rouge', bg: { type: 'solid' }, kit: 'urgence', dur: 8,
    scenes: [
      S('marquee', 0, 8, { text: '{m}', rows: 2, y: 0.09, size: 0.55, angle: 0, color: 'accent', stroke: 'ink', out: 'none', L: { y: 0.1, size: 0.45 } }),
      S('burst', 0.4, 4.4, { text: '{pct}', y: 0.47, color: 'accent', textColor: 'soft' }),
      S('countdown', 4.3, 8, { from: '{from}', y: 0.47, box: 'ink', digit: 'bg', out: 'none' }),
      S('cta', 4.8, 8, { text: '{cta}', y: 0.78, btn: 'accent', btnText: 'soft', cursor: false, out: 'none', L: { y: 0.86, size: 0.7 } }),
    ],
    f: { m: ['Bandeau', 'Vente flash', 20], pct: ['Réduction', '-70%', 6], from: ['Départ (HH:MM:SS)', '00:14:59', 8], cta: ['Bouton', 'Vite !', 18] } });

  T({ id: 'precommande', name: 'Précommande', obj: 'conatif', goal: 'Faire réserver en avance', type: 'edito', pal: 'encre', bg: { type: 'solid' }, grain: 0.1, vignette: 0.35, kit: 'cinema', dur: 9,
    scenes: [
      S('shapes', 0, 9, { kind: 'blob', x: 0.5, y: 0.42, color: 'accent', size: 1.1, alpha: 0.5, out: 'none' }),
      S('logo', 0.2, 4.2, { text: '{brand}', sub: '{sub}' }),
      S('title', 4.2, 9, { lines: ['{l1}', '{l2}'], style: 'blur', y: 0.4, colors: ['ink', 'accent'], out: 'none', L: { y: 0.34 } }),
      S('cta', 5.4, 9, { text: '{cta}', url: '{url}', y: 0.62, btn: 'ink', btnText: 'bg', cursorFill: 'ink', cursorStroke: 'bg', urlColor: 'ink', out: 'none', L: { y: 0.66, size: 0.8 } }),
    ],
    f: { brand: ['Produit', 'Orbite 2', 16], sub: ['Signature', 'Disponible le 3 décembre', 34], l1: ['Titre, ligne 1', 'Précommande', 16], l2: ['Titre, ligne 2', '*ouverte*', 16], cta: ['Bouton', 'Réserver le mien', 20], url: ['Site', 'orbite.audio', 28] } });

  T({ id: 'abonne-toi', name: 'Abonne-toi', obj: 'conatif', goal: 'Gagner des abonnés', type: 'bold', pal: 'corail', bg: { type: 'solid' }, kit: 'pop', dur: 7,
    scenes: [
      S('title', 0.1, 7, { lines: ['{l1}', '{l2}'], style: 'wave', y: 0.34, colors: ['ink', 'accent'], out: 'none', L: { y: 0.3, size: 0.85 } }),
      S('cta', 1.4, 7, { text: '{cta}', y: 0.58, btn: 'ink', btnText: 'accent', cursorFill: 'accent', cursorStroke: 'ink', out: 'none', L: { y: 0.62, size: 0.8 } }),
      S('caption', 2.2, 7, { text: '{sub}', y: 0.74, size: 38, weight: 600, out: 'none', L: { y: 0.84 } }),
      S('hearts', 3.2, 7, { count: 14, out: 'none' }),
    ],
    f: { l1: ['Titre, ligne 1', 'Pas encore', 14], l2: ['Titre, ligne 2', '*abonné* ?', 14], cta: ['Bouton', "S'abonner", 18], sub: ['Texte', 'Une vidéo utile chaque mardi.', 60] } });

  T({ id: 'derniere-chance', name: 'Dernière chance', obj: 'conatif', goal: 'Relancer avant la fin', type: 'bold', pal: 'nuit', bg: { type: 'solid' }, kit: 'urgence', dur: 7,
    scenes: [
      S('words', 0, 3.3, { text: '{w}', sep: '•', flash: true, bgs: ['accent', 'bg', 'ink'], colors: ['bg', 'ink', 'bg'], size: 1.1 }),
      S('title', 3.3, 7, { lines: ['{l1}'], style: 'scale', size: 0.8, y: 0.34, color: 'accent', out: 'none', L: { y: 0.28 } }),
      S('caption', 3.8, 7, { text: '{sub}', y: 0.47, size: 44, out: 'none', L: { y: 0.48 } }),
      S('cta', 4.2, 7, { text: '{cta}', y: 0.66, out: 'none', L: { y: 0.72, size: 0.8 } }),
    ],
    f: { w: ['Mots (• entre chaque)', 'Dernière • chance • ce soir', 50], l1: ['Titre', 'Minuit pile', 16], sub: ['Texte', "Après, l'offre disparaît pour de bon.", 70], cta: ['Bouton', 'Je fonce', 18] } });

  T({ id: 'offre-etheree', name: 'Offre éthérée', obj: 'conatif', goal: 'Vendre avec élégance', type: 'ether', pal: 'ether', bg: { type: 'image', src: 'hero', zoom: 1.2, px: 0.58 }, kit: 'ethere', dur: 10,
    scenes: [
      S('bubbles', 0, 10, { count: 12, out: 'none' }),
      S('glass', 0.5, 5.2, { eyebrow: '{eye}', title: '{title}', y: 0.5 }),
      S('glass', 5.2, 10, { title: '{t2}', sub: '{sub}', btn: '{btn}', y: 0.55, out: 'none' }),
    ],
    f: { eye: ['Surtitre', 'Soin signature', 24], title: ['Titre 1', 'Votre peau, *en apesanteur*.', 50], t2: ['Titre 2', '-25 % *cette semaine*', 40], sub: ['Texte', 'Sur tout le rituel lumière. Livraison offerte.', 80], btn: ['Bouton', 'Je découvre', 18] } });

  T({ id: 'places', name: 'Places limitées', obj: 'conatif', goal: 'Faire réserver vite', type: 'grot', pal: 'foret', bg: { type: 'solid' }, grain: 0.06, kit: 'urgence', dur: 8,
    scenes: [
      S('tag', 0.1, 8, { text: '{tag}', y: 0.16, out: 'none', color: 'accent', text2: 'bg', L: { y: 0.1 } }),
      S('counter', 0.3, 8, { value: '{n}', label: '{label}', y: 0.4, size: 1.3, out: 'none', countDur: 1.4, down: 4 }),
      S('cta', 3.6, 8, { text: '{cta}', y: 0.76, out: 'none', btnText: 'bg', L: { y: 0.86, size: 0.7 } }),
    ],
    f: { tag: ['Étiquette', 'Atelier céramique', 24], n: ['Nombre', '12', 6], label: ['Sous le chiffre', 'places restantes pour samedi', 50], cta: ['Bouton', 'Je réserve', 18] } });

  T({ id: 'livraison', name: 'Livraison offerte', obj: 'conatif', goal: 'Lever un frein à l’achat', type: 'grot', pal: 'citron', bg: { type: 'dots' }, kit: 'corporate', dur: 9,
    scenes: [
      S('title', 0.2, 9, { lines: ['{l1}', '{l2}'], style: 'split', y: 0.24, colors: ['ink', 'ink'], block: 'accent', out: 'none', L: { y: 0.2, size: 0.8 } }),
      S('checklist', 1.4, 9, { items: '{items}', y: 0.52, out: 'none', L: { y: 0.56 } }),
      S('cta', 4.4, 9, { text: '{cta}', y: 0.8, out: 'none', L: { y: 0.88, size: 0.62 } }),
    ],
    f: { l1: ['Titre, ligne 1', 'Livraison', 14], l2: ['Titre, ligne 2', '*offerte*', 14], items: ['Arguments (| entre chaque)', "Dès 30 € d'achat|Expédié sous 24 h|Retours gratuits", 100], cta: ['Bouton', 'Commander', 18] } });

  T({ id: 'parrainage', name: 'Parrainage', obj: 'conatif', goal: 'Faire partager', type: 'grot', pal: 'aube', bg: { type: 'mesh' }, kit: 'pop', dur: 10,
    scenes: [
      S('title', 0.1, 3, { lines: ['{l1}', '{l2}'], style: 'wave', y: 0.45, colors: ['ink', 'accent'], size: 1.2 }),
      S('compare', 3, 6.6, { la: '{la}', a: '{a}', lb: '{lb}', b: '{b}', ca: 'soft', cb: 'accent', tb: 'bg' }),
      S('code', 6.6, 10, { code: '{code}', label: '{label}', y: 0.42, out: 'none', L: { y: 0.38 } }),
      S('cta', 7.6, 10, { text: '{cta}', y: 0.72, cursor: false, out: 'none', L: { y: 0.78, size: 0.75 } }),
    ],
    f: { l1: ['Titre, ligne 1', 'Invite', 14], l2: ['Titre, ligne 2', 'un *ami*', 14], la: ['Étiquette gauche', 'Pour toi', 14], a: ['Gauche (| = retour)', '10 €|offerts', 20], lb: ['Étiquette droite', 'Pour ton ami', 14], b: ['Droite (| = retour)', '10 €|offerts', 20], code: ['Code', 'AMI-LUEUR', 14], label: ['Au-dessus du code', 'Ton code à partager', 30], cta: ['Bouton', 'Partager', 18] } });

  T({ id: 'soldes', name: 'Soldes typo', obj: 'conatif', goal: 'Annoncer les soldes', type: 'bold', pal: 'citron', bg: { type: 'solid' }, kit: 'punch', dur: 9,
    scenes: [
      S('marquee', 0, 4.4, { text: '{m}', rows: 5, y: 0.5 }),
      S('fill', 4.3, 9, { color: 'accent', how: 'iris' }),
      S('price', 4.6, 9, { old: '{old}', now: '{now}', y: 0.4, color: 'bg', strike: 'bg', out: 'none', L: { y: 0.4 } }),
      S('cta', 6, 9, { text: '{cta}', y: 0.72, btn: 'bg', btnText: 'ink', cursorFill: 'bg', cursorStroke: 'ink', out: 'none', L: { y: 0.8, size: 0.7 } }),
    ],
    f: { m: ['Bandeau', 'Soldes', 14], old: ['Ancien prix', '120 €', 10], now: ['Nouveau prix', '60 €', 10], cta: ['Bouton', 'Voir la sélection', 22] } });

  MS.TEMPLATES = L;
  MS.byId = id => L.find(t => t.id === id);
})();
