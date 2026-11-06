// Parcours préconçus des anagrammes mystères, lot 3 (partie 2) : jeu 6
// « Grande énigme » (docs/anagrammes-mysteres.md §4, §5, §6.3 et §14).
//
// Source : « Parcours préconçus des anagrammes mystères, lot 3 (partie 2) :
// jeu 6 « Grande énigme » — v0.1 » (DIBIE/contenus/grande-enigme-v0.1.md du
// dépôt JARVIS), rédigée par l'educator le 2026-11-05 (faits tirés de la fiche
// du researcher, DIBIE/contenus/grande-enigme-faits-v0.1.md, elle-même en
// BROUILLON), relue par le reviewer en un passage et VALIDÉE PAR ISAAC le
// 2026-11-05 (décisions E1 à E10, avec E2 option (b) et E9 aligné sur les jeux
// 2 et 3). Elle reste À VALIDER PAR UN ENSEIGNANT (E10) : statut 'draft' de
// chaque parcours. Contenu rédigé par une IA ; certains faits sont seulement
// « rapportés » (ND1 à ND3, T1 à T5, BK3, FM5, P1 : §8 de la source).
//
// Recopié fidèlement : mots d'étape, éléments gagnés et leur rang,
// définitions, identifiants du vocabulaire (« autre niveau », « autre sens »
// ou « — » dans la source : null), consignes, solutions, réponses acceptées,
// indices de la finale et textes des indices d'étape (avec le numéro du fait
// de la fiche). Seule différence de forme : les mots anglais sont écrits en
// capitales, comme dans la source et comme les tuiles.
//
// Format d'un parcours (§5 de la conception ; proposition du §7 de la source) :
// {
//   id, game: 'grandRiddle', language: 'fr' | 'en', level,
//   status: 'draft',            // draft | validated (validé par un enseignant)
//   steps: [{
//     word, display,            // mot à trouver (lettres de grille ; orthographe exacte)
//     definition,               // définition propre au parcours (§6.3, règle 1)
//     answers: [{ id, word, display }],  // id = entrée du vocabulaire de même
//                               // sens et de même niveau, sinon null
//     element                   // élément gagné, l'une de ces formes :
//                               // { type: 'letter', value, rank }  (rang dans le mot, 1 = 1re)
//                               // { type: 'syllable', value, rank, syllables }  (français seulement, E2)
//                               // { type: 'clue', text, factRef }  (indice rangé dans le carnet)
//   }],                         // étapes dans l'ordre de la solution (l'application
//                               // les présente dans un ordre mélangé, E9)
//   final: {
//     kind,                     // 'word' | 'heritage' | 'person' | 'proverb' (type d'énigme)
//     prompt,                   // consigne de la finale, telle que rédigée
//     proverbText?,             // proverbe : le texte affiché avec son trou (___)
//     solution,                 // orthographe exacte (mot principal ou mot manquant)
//     display?,                 // orthographe affichée à la fin, si la source en donne une autre (« Lobé »)
//     solutionId?,              // entrée du vocabulaire de la solution, si la source la cite
//     acceptedAnswers,          // variantes acceptées (E6), en plus de la solution
//     hints                     // 2 indices (E5) : fait ou devinette, puis première lettre
//   }
// }
// Les tuiles, l'ordre des étapes et la comparaison de la réponse tapée sont
// faits par src/utils/mysteryPresets.js et mysteryEngine.js ; chaque parcours
// est contrôlé par validatePath (règle J6 comprise) avant d'être montré.

import { normalizeWord } from '../utils/wordSearchGenerator.js'

const reponse = (display, id = null) => ({ id, word: normalizeWord(display), display })

const lettre = (value, rank) => ({ type: 'letter', value, rank })
const syllabe = (value, rank, syllabation) => ({ type: 'syllable', value, rank, syllables: syllabation.split('-') })
const indice = (text, factRef = null) => ({ type: 'clue', text, factRef })

// Étape : mot (capitales, accents), définition, élément gagné, id du vocabulaire (ou null)
const etape = (display, definition, element, id = null) =>
  ({ word: normalizeWord(display), display, definition, answers: [reponse(display, id)], element })

const enigme = (id, language, level, steps, final) =>
  ({ id, game: 'grandRiddle', language, level, status: 'draft', steps, final })

export const GRANDE_ENIGME = Object.freeze([
  // --- Français, SIL-CP (mots d'étape de 3 à 5 lettres, première lettre placée) ---

  enigme('grande-enigme-fr-sil-cp-01', 'fr', 'SIL-CP', [
    etape('BOL', 'Petit récipient rond dans lequel on boit ou on mange.', lettre('L', 3), 'vocab_0858'),
    etape('RADIO', 'Appareil qui permet d\'écouter de la musique et les nouvelles.', lettre('O', 5), 'vocab_0887'),
    etape('ROBE', 'Vêtement d\'une seule pièce que portent les filles et les femmes.', lettre('B', 3), 'vocab_0812'),
    etape('LUNE', 'Elle brille dans le ciel pendant la nuit.', lettre('E', 4))
  ], {
    kind: 'heritage',
    prompt: 'Retrouve le nom de ces chutes d\'eau du Cameroun : les chutes de la ___.',
    solution: 'LOBÉ',
    acceptedAnswers: ['LOBE', 'CHUTES DE LA LOBÉ'],
    hints: [
      // Faits L1, L2 (vérifiés)
      'Ces chutes sont près de Kribi, et leur eau tombe directement dans la mer, l\'océan Atlantique.',
      'Le nom commence par L.'
    ]
  }),

  enigme('grande-enigme-fr-sil-cp-02', 'fr', 'SIL-CP', [
    etape('LAPIN', 'Petit animal aux grandes oreilles qui aime les carottes.', lettre('N', 5), 'vocab_0761'),
    // Autre sens dans le vocabulaire : vocab_0172 (CM1-CM2, pied d'une hauteur)
    etape('PIED', 'Partie du corps au bout de la jambe ; on marche dessus.', lettre('D', 4), 'vocab_0844'),
    etape('STYLO', 'Objet rempli d\'encre qui sert à écrire.', lettre('O', 5), 'vocab_1413'),
    etape('CIEL', 'Au-dessus de nos têtes, il est bleu quand il fait beau.', lettre('L', 4)),
    // Autre niveau : vocab_0522 (CE1-CE2)
    etape('PLUIE', 'Eau qui tombe des nuages.', lettre('E', 5))
  ], {
    kind: 'heritage',
    // Fait ND1 (rapporté)
    prompt: 'Retrouve le nom de ce plat camerounais très connu.',
    solution: 'NDOLÈ',
    acceptedAnswers: ['NDOLÈ', 'NDOLÉ', 'NDOLE'],
    hints: [
      // Faits ND2, ND3 (rapportés)
      'On le prépare avec des feuilles amères et de la pâte d\'arachides.',
      'Le mot commence par N.'
    ]
  }),

  enigme('grande-enigme-fr-sil-cp-03', 'fr', 'SIL-CP', [
    // Autre niveau : vocab_1455 (CE1-CE2)
    etape('NID', 'Petite maison que l\'oiseau construit avec des brindilles pour y pondre ses œufs.', lettre('D', 3)),
    etape('PAPA', 'Nom que l\'enfant donne à son père.', lettre('A', 4)),
    etape('MAIN', 'Partie du corps au bout du bras ; elle a cinq doigts.', lettre('N', 4), 'vocab_0840'),
    // Autre niveau : vocab_0454 (CE1-CE2)
    etape('BUS', 'Grand véhicule qui transporte beaucoup de passagers.', lettre('S', 3)),
    // Autre niveau : vocab_1094 (CE1-CE2)
    etape('FÊTE', 'Moment de joie, en famille ou entre amis, pour célébrer un événement.', lettre('E', 4))
  ], {
    kind: 'word',
    prompt: 'Retrouve le mot caché.',
    solution: 'DANSE',
    acceptedAnswers: ['DANSE'],
    hints: [
      // Devinette, aucun fait culturel
      'On la fait en bougeant le corps au rythme de la musique.',
      'Le mot commence par D.'
    ]
  }),

  // --- Français, CE1-CE2 (mots d'étape de 4 à 7 lettres) ---

  enigme('grande-enigme-fr-ce1-ce2-01', 'fr', 'CE1-CE2', [
    // Autre niveau : vocab_1001 (SIL-CP)
    etape('MAILLOT', 'Vêtement que portent les joueurs d\'une même équipe, avec un numéro dans le dos.', lettre('M', 1)),
    // Autre niveau : vocab_0384 (CM1-CM2)
    etape('ARBITRE', 'Personne qui fait respecter les règles du jeu sur le terrain.', lettre('I', 4)),
    // Autre niveau : vocab_0826 (SIL-CP)
    etape('BALLON', 'Objet rond que les joueurs frappent du pied.', lettre('L', 3)),
    etape('FILET', 'Au football, il est accroché derrière les poteaux et retient la balle quand un but est marqué.', lettre('L', 3)),
    etape('MATCH', 'Rencontre sportive entre deux équipes.', lettre('A', 2)),
    etape('SPORTIF', 'Personne qui fait souvent de la course, de la natation ou du football.',
      indice('À la Coupe du monde 1990, en Italie, il a marqué 4 buts, à 38 ans.', 'RM2'))
  ], {
    kind: 'person',
    prompt: 'Qui est ce footballeur camerounais ? Écris son nom de famille.',
    solution: 'MILLA',
    // MILLER (graphie ancienne) non accepté par défaut (E6)
    acceptedAnswers: ['MILLA', 'ROGER MILLA', 'ALBERT ROGER MOOH MILLA'],
    hints: [
      // Fait RM3 (vérifié)
      'Il fêtait ses buts en dansant près du poteau de corner.',
      'Son prénom est Roger ; son nom commence par M.'
    ]
  }),

  enigme('grande-enigme-fr-ce1-ce2-02', 'fr', 'CE1-CE2', [
    etape('DOUZE', 'Dix plus deux.', lettre('D', 1)),
    etape('JOUR', 'Période de vingt-quatre heures.', lettre('J', 1)),
    // Autre niveau : vocab_0874 (SIL-CP)
    etape('PLANTE', 'Être vivant qui pousse dans la terre, comme l\'herbe ou l\'arbre.', lettre('A', 3)),
    etape('GORILLE', 'Le plus grand des singes ; il est très fort et vit dans la forêt.',
      indice('Elle se trouve dans les régions du Sud et de l\'Est du Cameroun. Elle est inscrite au patrimoine mondial de l\'UNESCO depuis 1987.', 'D6, D1'))
  ], {
    kind: 'heritage',
    prompt: 'Retrouve le nom de cette réserve de faune du Cameroun : la réserve du ___.',
    solution: 'DJA',
    acceptedAnswers: ['DJA', 'RÉSERVE DU DJA', 'RÉSERVE DE FAUNE DU DJA'],
    hints: [
      // Faits D4, D2 (vérifiés)
      'On y trouve des gorilles, des chimpanzés et des éléphants de forêt. Un fleuve qui porte le même nom qu\'elle l\'entoure presque entièrement.',
      'Le nom commence par D.'
    ]
  }),

  enigme('grande-enigme-fr-ce1-ce2-03', 'fr', 'CE1-CE2', [
    etape('BATEAU', 'Il flotte sur l\'eau et transporte des personnes ou des marchandises.', syllabe('BA', 1, 'BA-TEAU'), 'vocab_1172'),
    etape('SALADE', 'Plat de feuilles vertes, comme la laitue, que l\'on mange souvent froid.', syllabe('LA', 2, 'SA-LA-DE')),
    etape('FONCÉ', 'Se dit d\'une couleur sombre ; c\'est le contraire de clair.', syllabe('FON', 1, 'FON-CÉ')),
    etape('MUSIQUE', 'Art des sons : on la joue avec des instruments ou on la chante.',
      indice('Ses lames en bois ont des longueurs différentes ; on les frappe avec des baguettes.', 'BA2, BA4'), 'vocab_1009')
  ], {
    kind: 'word',
    prompt: 'Retrouve le nom de cet instrument de musique africain.',
    solution: 'BALAFON',
    solutionId: 'vocab_0550',
    acceptedAnswers: ['BALAFON'],
    hints: [
      // Faits BA1, BA3 (vérifiés)
      'Il est de la famille du xylophone ; sous les lames, des calebasses font résonner le son.',
      'Le mot commence par BA.'
    ]
  }),

  // --- Français, CM1-CM2 (mots d'étape de 6 à 10 lettres) ---

  enigme('grande-enigme-fr-cm1-cm2-01', 'fr', 'CM1-CM2', [
    etape('MÉDAILLE', 'Petit disque de métal que l\'on donne aux meilleurs d\'une compétition.', lettre('M', 1)),
    etape('BANQUE', 'Établissement où l\'on garde son argent.', syllabe('BAN', 1, 'BAN-QUE'), 'vocab_1257'),
    etape('GORILLE', 'Le plus grand des singes ; il est très fort et vit dans la forêt.', syllabe('GO', 1, 'GO-RIL-LE')),
    etape('VICTOIRE', 'Le fait de gagner un match, une course ou une compétition.',
      indice('Sa discipline est le triple saut.', 'FM2')),
    etape('PODIUM', 'Petite estrade à trois marches où montent les trois premiers d\'une course.',
      indice('Elle a gagné la médaille d\'or olympique à Athènes en 2004, puis une deuxième médaille d\'or à Pékin en 2008.', 'FM3, FM4'))
  ], {
    kind: 'person',
    prompt: 'Qui est cette athlète camerounaise ? Écris son nom de famille.',
    solution: 'MBANGO',
    acceptedAnswers: ['MBANGO', 'FRANÇOISE MBANGO', 'MBANGO ETONE', 'FRANÇOISE MBANGO ETONE'],
    hints: [
      // Fait FM5 (rapporté)
      'En 2004, elle est devenue la première championne olympique du Cameroun dans une épreuve individuelle.',
      'Son prénom est Françoise ; son nom commence par M.'
    ]
  }),

  enigme('grande-enigme-fr-cm1-cm2-02', 'fr', 'CM1-CM2', [
    // Autre niveau : vocab_0800 (SIL-CP)
    etape('TOMATE', 'Fruit rouge et rond que l\'on met dans la sauce.', syllabe('TO', 1, 'TO-MA-TE')),
    etape('AIGUILLE', 'Petite tige de métal pointue, percée d\'un trou, qui sert à coudre.', lettre('G', 3)),
    // Autre niveau : vocab_0818 (SIL-CP)
    etape('CHAPEAU', 'On le porte sur la tête pour se protéger du soleil.', lettre('H', 2)),
    etape('COUTURE', 'Travail qui consiste à assembler des morceaux de tissu avec du fil.', lettre('U', 3)),
    etape('BRODERIE', 'Dessin cousu avec du fil de couleur sur un tissu.',
      indice('Il vient de la région du Nord-Ouest du Cameroun, autour de Bamenda.', 'T2')),
    etape('VÊTEMENT', 'Ce que l\'on porte sur le corps, comme une chemise, une robe ou un pantalon.',
      indice('Autrefois, il était réservé aux rois, aux chefs et aux dignitaires.', 'T3'))
  ], {
    kind: 'heritage',
    // Fait T1 (rapporté)
    prompt: 'Retrouve le nom de ce tissu brodé traditionnel du Cameroun.',
    solution: 'TOGHU',
    solutionId: 'vocab_1278',
    // TOGUH non accepté (E6)
    acceptedAnswers: ['TOGHU', 'ATOGHU'],
    hints: [
      // Faits T4, T5 (rapportés)
      'Son fond est souvent noir, avec des broderies de couleurs vives. Aujourd\'hui, on le porte pour les fêtes et les cérémonies.',
      'Le mot commence par T.'
    ]
  }),

  enigme('grande-enigme-fr-cm1-cm2-03', 'fr', 'CM1-CM2', [
    // Autre niveau : vocab_1417 (SIL-CP)
    etape('PAPIER', 'Matière mince faite à partir du bois, sur laquelle on écrit.', syllabe('PIER', 2, 'PA-PIER')),
    // Autre niveau : vocab_0652 (CE1-CE2), vocab_0850 (SIL-CP)
    etape('MARMITE', 'Grand récipient dans lequel on fait cuire les aliments sur le feu.', lettre('R', 3)),
    // Autre niveau : vocab_0631 (CE1-CE2), vocab_0983 (SIL-CP)
    etape('CUISINE', 'Pièce de la maison où l\'on prépare les repas.', lettre('E', 7)),
    // Autre niveau : vocab_1038 (CE1-CE2)
    etape('TORTUE', 'Animal lent qui porte une carapace sur le dos.',
      indice('Le mot manquant désigne une chose très dure, que personne ne peut faire cuire d\'habitude.')),
    etape('SAGESSE', 'Qualité d\'une personne qui réfléchit bien avant d\'agir et donne de bons conseils.',
      indice('Ce proverbe est connu dans plusieurs pays d\'Afrique, dont le Cameroun.', 'P1'))
  ], {
    kind: 'proverb',
    // Texte P1 tel que publié par la source, sans correction (E7)
    prompt: 'Complète ce proverbe africain : « Avec beaucoup de patience on peut cuire même une ___. »',
    proverbText: 'Avec beaucoup de patience on peut cuire même une ___.',
    solution: 'PIERRE',
    acceptedAnswers: ['PIERRE'],
    hints: [
      // Explication du sens, rédigée par l'educator
      'Ce proverbe veut dire qu\'avec du temps et des efforts, on peut réussir une chose très difficile.',
      'Le mot commence par P.'
    ]
  }),

  // --- Anglais, SIL-CP (Class 1-2, mots d'étape de 3 à 5 lettres, première lettre placée) ---

  enigme('grande-enigme-en-sil-cp-01', 'en', 'SIL-CP', [
    // Deux entrées de même sens au SIL-CP (BALLON vocab_0826, BALLE vocab_0829)
    etape('BALL', 'A round toy that we kick or throw.', lettre('L', 4), 'vocab_0826'),
    etape('HELLO', 'A word we say when we meet someone.', lettre('O', 5)),
    etape('WEB', 'A spider makes it to catch insects.', lettre('B', 3)),
    // Autre niveau : vocab_1131 (Class 3-4)
    etape('TREE', 'A tall plant with a trunk, branches and leaves.', lettre('E', 4))
  ], {
    kind: 'heritage',
    prompt: 'Find the name of these waterfalls in Cameroon: the ___ Falls.',
    solution: 'LOBE',
    display: 'Lobé',
    acceptedAnswers: ['LOBE', 'LOBE FALLS'],
    hints: [
      // Faits L1, L2 (vérifiés)
      'These waterfalls are near Kribi, and their water falls straight into the sea, the Atlantic Ocean.',
      'The name begins with L.'
    ]
  }),

  enigme('grande-enigme-en-sil-cp-02', 'en', 'SIL-CP', [
    etape('SEVEN', 'Six plus one.', lettre('N', 5)),
    etape('BED', 'We sleep in it at night.', lettre('D', 3), 'vocab_0722'),
    etape('MANGO', 'A sweet fruit, yellow or orange inside, with a big seed in the middle.', lettre('O', 5), 'vocab_0792'),
    etape('GIRL', 'A child who will grow up to be a woman.', lettre('L', 4)),
    etape('HOUSE', 'A building where a family lives.', lettre('E', 5), 'vocab_0917')
  ], {
    kind: 'heritage',
    // Fait ND1 (rapporté)
    prompt: 'Find the name of this well-known Cameroonian dish.',
    solution: 'NDOLE',
    display: 'Ndolé',
    acceptedAnswers: ['NDOLE', 'NDOLÉ', 'NDOLÈ'],
    hints: [
      // Faits ND2, ND3 (rapportés)
      'It is made with bitter leaves and groundnut paste.',
      'The word begins with N.'
    ]
  }),

  enigme('grande-enigme-en-sil-cp-03', 'en', 'SIL-CP', [
    etape('BIRD', 'An animal with feathers and wings; most of them can fly.', lettre('D', 4), 'vocab_0916'),
    etape('ZEBRA', 'An animal like a horse, with black and white stripes.', lettre('A', 5), 'vocab_1411'),
    etape('LEMON', 'A small yellow fruit with a sour taste.', lettre('N', 5), 'vocab_0796'),
    // Autre niveau : vocab_1009 (Class 3-4)
    etape('MUSIC', 'Songs and sounds made with voices or instruments.', lettre('C', 5)),
    etape('SHOE', 'We wear it on our foot to walk.', lettre('E', 4), 'vocab_0816')
  ], {
    kind: 'word',
    prompt: 'Find the hidden word.',
    solution: 'DANCE',
    acceptedAnswers: ['DANCE'],
    hints: [
      // Devinette
      'People do it when they move their body to the rhythm of music.',
      'The word begins with D.'
    ]
  }),

  // --- Anglais, CE1-CE2 (Class 3-4, mots d'étape de 4 à 7 lettres) ---

  enigme('grande-enigme-en-ce1-ce2-01', 'en', 'CE1-CE2', [
    // Autre niveau : vocab_1177 (Class 5-6)
    etape('MINUTE', 'Sixty seconds make one of these.', lettre('M', 1)),
    etape('WINNER', 'The person or team that comes first.', lettre('I', 2)),
    // Autre niveau : vocab_0782 (Class 1-2)
    etape('YELLOW', 'The colour of a ripe banana.', lettre('L', 3)),
    etape('WHISTLE', 'The referee blows into it to stop the game.', lettre('L', 6), 'vocab_0560'),
    // Autre niveau : vocab_1507 (Class 5-6)
    etape('COACH', 'The person who trains a team and helps the players get better.', lettre('A', 3)),
    etape('STADIUM', 'A big sports ground with seats all around, where crowds watch games.',
      indice('At the 1990 World Cup in Italy, he scored 4 goals at the age of 38.', 'RM2'), 'vocab_1068')
  ], {
    kind: 'person',
    prompt: 'Who is this Cameroonian footballer? Write his surname.',
    solution: 'MILLA',
    // MILLER non accepté par défaut (E6)
    acceptedAnswers: ['MILLA', 'ROGER MILLA', 'ALBERT ROGER MOOH MILLA'],
    hints: [
      // Fait RM3 (vérifié)
      'He celebrated his goals by dancing near the corner flag.',
      'His first name is Roger; his surname begins with M.'
    ]
  }),

  enigme('grande-enigme-en-ce1-ce2-02', 'en', 'CE1-CE2', [
    // Doublon de même sens : vocab_0480
    etape('DOCTOR', 'A person whose job is to look after sick people.', lettre('D', 1), 'vocab_0690'),
    etape('JUICE', 'A drink made by pressing fruit.', lettre('J', 1)),
    // Autre niveau : vocab_0791 (Class 1-2)
    etape('BANANA', 'A long yellow fruit that monkeys love.', lettre('A', 2)),
    etape('RIVER', 'A long stream of fresh water that flows to the sea or to a lake.',
      indice('It is in the South and East regions of Cameroon. It has been a UNESCO World Heritage Site since 1987.', 'D6, D1'), 'vocab_1027')
  ], {
    kind: 'heritage',
    prompt: 'Find the name of this nature reserve in Cameroon: the ___ Faunal Reserve.',
    solution: 'DJA',
    acceptedAnswers: ['DJA', 'DJA FAUNAL RESERVE', 'DJA RESERVE'],
    hints: [
      // Faits D4, D2 (vérifiés)
      'Gorillas, chimpanzees and forest elephants live there. A river with the same name goes almost all the way around it.',
      'The name begins with D.'
    ]
  }),

  enigme('grande-enigme-en-ce1-ce2-03', 'en', 'CE1-CE2', [
    etape('DINNER', 'The meal we eat in the evening.', lettre('D', 1), 'vocab_1170'),
    // Autre niveau : vocab_0801 (Class 1-2)
    etape('CARROT', 'A long orange vegetable that rabbits like.', lettre('R', 3)),
    // Autre sens : vocab_0417 (Class 3-4, souris d'ordinateur)
    etape('MOUSE', 'A small grey animal with a long tail.', lettre('U', 3)),
    // Autre niveau : vocab_0800 (Class 1-2)
    etape('TOMATO', 'A round red fruit that we often cook in sauces.', lettre('M', 3)),
    etape('RHYTHM', 'A regular pattern of beats in music.',
      indice('At first, bikutsi music from Cameroon was played with balafons and with these instruments.', 'BK3'), 'vocab_1007')
  ], {
    kind: 'word',
    prompt: 'Find the hidden word: it is a musical instrument.',
    solution: 'DRUM',
    solutionId: 'vocab_0549',
    // DRUMS non accepté par défaut (E6)
    acceptedAnswers: ['DRUM'],
    hints: [
      // Devinette
      'We hit it with our hands or with sticks to make a beat.',
      'The word begins with D.'
    ]
  }),

  // --- Anglais, CM1-CM2 (Class 5-6, mots d'étape de 6 à 10 lettres) ---

  // 7 étapes (6 lettres + 1 indice) : décision d'Isaac du 2026-11-05 (E2, option b)
  enigme('grande-enigme-en-cm1-cm2-01', 'en', 'CM1-CM2', [
    etape('CHAMPION', 'A person who wins a big competition.', lettre('M', 4)),
    etape('NUMBER', 'One, two and three are each one of these.', lettre('B', 4), 'vocab_0096'),
    etape('ATHLETE', 'A person who trains hard and takes part in sports competitions.', lettre('A', 1)),
    etape('RUNNING', 'Moving very fast on your legs.', lettre('N', 3)),
    etape('JUMPING', 'Pushing hard with your legs to leave the ground.', lettre('G', 7)),
    etape('OLYMPIC', 'Describes the big Games held every four years, where sportspeople from many countries compete.', lettre('O', 1)),
    // Autre sens : vocab_0007 (sens financier). Étape ajoutée par JARVIS après
    // la relecture du reviewer, non relue (source, notes du parcours)
    etape('CAPITAL', 'The main city of a country, where the government works.',
      indice('She was born in Yaoundé on 14 April 1976.', 'FM1'))
  ], {
    kind: 'person',
    // Fait FM5 (rapporté). Contient CHAMPION et OLYMPIC, mots d'étape : la
    // consigne n'est affichée qu'à la finale (remarque F4 du reviewer)
    prompt: 'Who is this Cameroonian athlete? In 2004, she became Cameroon\'s first Olympic champion in an individual event. Write her surname.',
    solution: 'MBANGO',
    acceptedAnswers: ['MBANGO', 'FRANCOISE MBANGO', 'MBANGO ETONE', 'FRANCOISE MBANGO ETONE'],
    hints: [
      // Faits FM2, FM3, FM4 (vérifiés)
      'Her event is the triple jump. She won Olympic gold in Athens in 2004 and again in Beijing in 2008.',
      'Her first name is Françoise; her surname begins with M.'
    ]
  }),

  enigme('grande-enigme-en-cm1-cm2-02', 'en', 'CM1-CM2', [
    // Autre niveau : vocab_0482 (Class 3-4)
    etape('TAILOR', 'A person whose job is making clothes.', lettre('T', 1)),
    etape('COTTON', 'A soft white plant fibre used to make cloth.', lettre('O', 2), 'vocab_1270'),
    etape('BRIGHT', 'Full of light; also describes a strong, vivid colour.', lettre('G', 4)),
    etape('FASHION', 'The style of clothes that is popular at a certain time.', lettre('H', 4)),
    // Autre niveau : vocab_1109 (Class 3-4)
    etape('COSTUME', 'Special clothes that an actor wears in a show.', lettre('U', 5)),
    etape('PATTERN', 'A design of lines, shapes or colours that is repeated, for example on cloth.',
      indice('It comes from the North-West region of Cameroon, around Bamenda.', 'T2'))
  ], {
    kind: 'heritage',
    // Fait T1 (rapporté)
    prompt: 'Find the name of this traditional embroidered cloth from Cameroon.',
    solution: 'TOGHU',
    solutionId: 'vocab_1278',
    acceptedAnswers: ['TOGHU', 'ATOGHU'],
    hints: [
      // Faits T3, T4 (rapportés)
      'In the past, only kings, chiefs and dignitaries wore it. It often has a black background, with bright embroidery.',
      'The word begins with T.'
    ]
  }),

  enigme('grande-enigme-en-cm1-cm2-03', 'en', 'CM1-CM2', [
    // Autre niveau : vocab_0596 (Class 3-4), vocab_0767 (Class 1-2)
    etape('SCHOOL', 'A place where children go to learn.', lettre('S', 1)),
    etape('POTATO', 'A vegetable that grows under the ground; we can boil it or fry it.', lettre('T', 3)),
    etape('FIREWOOD', 'Dry sticks and logs that we burn to cook food.', lettre('O', 6)),
    // Autre niveau : vocab_0534 (Class 3-4)
    etape('PLANTAIN', 'A fruit like a big banana that we cook before eating.', lettre('N', 4)),
    // Autre sens et autre niveau : vocab_0903 (Class 1-2, poivron)
    etape('PEPPER', 'A spice that makes food taste hot.', lettre('E', 2)),
    etape('PROVERB', 'A short, well-known saying that gives advice.',
      indice('This proverb is known in several African countries, including Cameroon.', 'P1'), 'vocab_0371')
  ], {
    kind: 'proverb',
    // Texte P1 tel que publié par la source, sans correction (E7)
    prompt: 'Complete this African proverb: "Patience can cook a ___."',
    proverbText: 'Patience can cook a ___.',
    solution: 'STONE',
    acceptedAnswers: ['STONE'],
    hints: [
      // Devinette
      'The missing word names something very hard, which nobody can usually cook.',
      'The word begins with S.'
    ]
  })
])
