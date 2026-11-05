// Parcours préconçus des anagrammes mystères, lot 3 (partie 1) : jeu 2
// « Casse-tête des syllabes » et jeu 3 « Phrase secrète »
// (docs/anagrammes-mysteres.md §4, §5, §6.3 et §13).
//
// Source : « Parcours préconçus des anagrammes mystères — v0.1 »
// (DIBIE/contenus/parcours-mysteres-v0.1.md du dépôt JARVIS), proposée par
// l'educator le 2026-11-04, vérifiée en partie par le researcher le 2026-11-04,
// relue par le reviewer le 2026-11-05 et VALIDÉE PAR ISAAC le 2026-11-05
// (contenus et décisions I1 à I14, selon les recommandations). Elle reste À
// VALIDER PAR UN ENSEIGNANT (décision M3, I12) : statut 'draft' de chaque
// parcours. Contenu rédigé par une IA : syllabations écrites de mémoire, en
// partie contrôlées (voir la source, §6).
//
// Recopié fidèlement : mots, syllabations, syllabes données, définitions,
// identifiants du vocabulaire, phrases, mots donnés, phrases acceptées et
// indices. Seules différences de forme : mots et syllabes anglais en capitales
// (comme les tuiles) ; phrases à sujet inversé RETIRÉES en CE1-CE2 (décision
// I13 : acceptées en CM1-CM2 seulement).
//
// Format d'un parcours (§5 de la conception) :
// {
//   id,                       // identifiant du contenu
//   game: 'syllables' | 'secretSentence',
//   language: 'fr' | 'en', level,
//   status: 'draft',          // draft | validated (validé par un enseignant)
//   steps: [{
//     word,                   // mot à trouver, en lettres de grille (sans accents)
//     display,                // orthographe exacte, en capitales
//     definition,             // définition propre au parcours (§6.3, règle 1)
//     answers: [{ id, word, display }],  // réponses acceptées ; id = entrée du
//                             // vocabulaire de même sens et de même niveau, sinon
//                             // null (décision I10 : TABLE, CÔTÉ, GROS, PLAY)
//     secret,                 // jeu 2 : syllabe donnée ; jeu 3 : le mot tel qu'il
//                             // est écrit dans la phrase de référence
//     syllables?,             // jeu 2 : syllabation du mot
//     syllableRank?           // jeu 2 : rang de la syllabe donnée (1 = 1re)
//   }],                       // étapes dans l'ordre de la solution (l'application
//                             // les présente dans un ordre mélangé, décision I8)
//   final: {
//     solution,               // jeu 2 : mot mystère en lettres de grille ;
//                             // jeu 3 : phrase de référence (majuscule, virgules, point)
//     display?, syllables?,   // jeu 2 : orthographe montrée à la fin (I6), syllabation
//     given?,                 // jeu 3 : mots donnés d'office (décision I4)
//     acceptedAnswers,        // jeu 2 : le seul mot mystère ; jeu 3 : les phrases acceptées
//     hints                   // décision I9 : jeu 2, définition puis première syllabe ;
//                             // jeu 3, premier mot puis verbe
//   }
// }
// Les tuiles, l'ordre des étapes et les étiquettes de la finale sont tirés par
// src/utils/mysteryPresets.js ; chaque parcours est contrôlé par validatePath
// avant d'être montré (un parcours qui échoue n'est jamais montré).

import { normalizeWord } from '../utils/wordSearchGenerator.js'
import { gridTokens } from '../utils/anagramGame.js'

export const PRESET_STATUSES = Object.freeze(['draft', 'validated'])

const reponse = (display, id = null) => ({ id, word: normalizeWord(display), display })

// Étape du jeu 2 : mot (capitales, accents), syllabation avec tirets, rang de
// la syllabe donnée (1 = 1re), définition, id du vocabulaire (ou null),
// autres réponses acceptées (anagrammes du vocabulaire, D9)
function syllabe(display, syllabation, rang, definition, id = null, autres = []) {
  const syllables = syllabation.split('-')
  return {
    word: normalizeWord(display),
    display,
    definition,
    answers: [reponse(display, id), ...autres],
    secret: syllables[rang - 1],
    syllables,
    // Rang de la syllabe donnée, compté à partir de 1 : il désigne la bonne
    // syllabe quand deux s'écrivent de même sans accents (TÊ-TE : TE, la 2e)
    syllableRank: rang
  }
}

// Résolution du jeu 2 : mot mystère, syllabation, id du vocabulaire, indices
function motMystere(display, syllabation, id, hints) {
  return {
    solution: normalizeWord(display),
    display,
    syllables: syllabation.split('-'),
    acceptedAnswers: [reponse(display, id)],
    hints
  }
}

// Étape du jeu 3 : le mot tel qu'il est écrit dans la phrase, définition, id
function mot(ecrit, definition, id = null) {
  const display = ecrit.toLocaleUpperCase('fr-FR')
  return { word: normalizeWord(display), display, definition, answers: [reponse(display, id)], secret: ecrit }
}

const phrase = (texte) => ({ id: null, word: gridTokens(texte).join(' '), display: texte })

// Résolution du jeu 3 : phrase de référence, mots donnés, phrases acceptées
// (la première est la phrase de référence), indices
function phraseSecrete(solution, given, acceptees, hints) {
  return { solution, given, acceptedAnswers: acceptees.map(phrase), hints }
}

const syllabes = (id, language, level, steps, final) =>
  ({ id, game: 'syllables', language, level, status: 'draft', steps, final })
const phraseJeu = (id, language, level, steps, final) =>
  ({ id, game: 'secretSentence', language, level, status: 'draft', steps, final })

// --- Jeu 2 : Casse-tête des syllabes (20 parcours) ---

const JEU_2 = [
  // Français, SIL-CP (mots d'étape de 3 à 5 lettres, première lettre placée)
  syllabes('syllabes-fr-sil-cp-01', 'fr', 'SIL-CP', [
    syllabe('LACET', 'LA-CET', 1, 'Cordon que l\'on noue pour fermer une chaussure.'),
    syllabe('PINCE', 'PIN-CE', 1, 'Outil pour serrer ou tordre un fil de fer.', 'vocab_0932')
  ], motMystere('LAPIN', 'LA-PIN', 'vocab_0761', [
    'Petit animal aux grandes oreilles qui aime les carottes.',
    'Le mot commence par LA.'
  ])),
  syllabes('syllabes-fr-sil-cp-02', 'fr', 'SIL-CP', [
    syllabe('MOTO', 'MO-TO', 2, 'Véhicule à deux roues, avec un moteur, plus rapide qu\'un vélo.'),
    syllabe('MAMAN', 'MA-MAN', 1, 'Nom que l\'enfant donne à sa mère.'),
    syllabe('TÊTE', 'TÊ-TE', 2, 'Partie du corps où sont les yeux, le nez et la bouche.', 'vocab_0835')
  ], motMystere('TOMATE', 'TO-MA-TE', 'vocab_0800', [
    'Fruit rouge et rond que l\'on met dans la sauce ou dans la salade.',
    'Le mot commence par TO.'
  ])),
  syllabes('syllabes-fr-sil-cp-03', 'fr', 'SIL-CP', [
    syllabe('JUDO', 'JU-DO', 2, 'Sport de combat où l\'on porte un habit blanc et une ceinture.'),
    syllabe('MIDI', 'MI-DI', 1, 'Le milieu de la journée, quand on prend souvent le repas.'),
    syllabe('NOTE', 'NO-TE', 1, 'Le maître la met sur ton cahier pour dire si ton travail est bien fait.')
  ], motMystere('DOMINO', 'DO-MI-NO', 'vocab_0831', [
    'Petite plaque à points que l\'on aligne bout à bout pour jouer.',
    'Le mot commence par DO.'
  ])),
  syllabes('syllabes-fr-sil-cp-04', 'fr', 'SIL-CP', [
    syllabe('CAGE', 'CA-GE', 1, 'Boîte avec des barreaux où l\'on garde un oiseau.'),
    syllabe('NAGE', 'NA-GE', 1, 'On la fait dans l\'eau avec les bras et les jambes, comme le poisson.'),
    syllabe('PÉPIN', 'PÉ-PIN', 1, 'Petite graine que l\'on trouve dans une orange ou une pomme.')
  ], motMystere('CANAPÉ', 'CA-NA-PÉ', 'vocab_0709', [
    'Long siège moelleux du salon, où l\'on s\'assoit à plusieurs.',
    'Le mot commence par CA.'
  ])),

  // Français, CE1-CE2 (mots d'étape de 4 à 7 lettres)
  syllabes('syllabes-fr-ce1-ce2-01', 'fr', 'CE1-CE2', [
    // Autre sens dans le vocabulaire (vocab_0130, côté d'un polygone) : non relié (I10)
    syllabe('CÔTÉ', 'CÔ-TÉ', 2, 'Je suis assis à ___ de mon ami, tout près de lui.'),
    syllabe('LÉGUME', 'LÉ-GU-ME', 1, 'Plante que l\'on cultive pour la manger, comme la carotte ou le haricot.'),
    syllabe('PHOTO', 'PHO-TO', 1, 'Image que l\'on prend pour garder un souvenir.'),
    syllabe('CABANE', 'CA-BA-NE', 3, 'Petite maison simple, souvent en bois ou en branches.')
  ], motMystere('TÉLÉPHONE', 'TÉ-LÉ-PHO-NE', 'vocab_1013', [
    'Appareil qui permet de parler avec quelqu\'un qui est loin.',
    'Le mot commence par TÉ.'
  ])),
  syllabes('syllabes-fr-ce1-ce2-02', 'fr', 'CE1-CE2', [
    syllabe('MICRO', 'MI-CRO', 2, 'Appareil dans lequel on parle ou on chante pour que la voix soit plus forte.'),
    syllabe('COPAIN', 'CO-PAIN', 1, 'Ami avec qui l\'on aime jouer.'),
    syllabe('MARDI', 'MAR-DI', 2, 'Jour de la semaine qui vient après lundi.'),
    syllabe('BOULE', 'BOU-LE', 2, 'Objet tout rond, comme une bille ou un ballon.')
  ], motMystere('CROCODILE', 'CRO-CO-DI-LE', 'vocab_1034', [
    'Grand reptile aux fortes mâchoires qui vit dans l\'eau ou près de l\'eau.',
    'Le mot commence par CRO.'
  ])),
  syllabes('syllabes-fr-ce1-ce2-03', 'fr', 'CE1-CE2', [
    syllabe('CANARD', 'CA-NARD', 1, 'Oiseau au bec plat qui aime nager dans la mare.', 'vocab_0623'),
    syllabe('MÉDECIN', 'MÉ-DE-CIN', 1, 'Professionnel qui soigne les malades.', 'vocab_0480'),
    syllabe('RADIS', 'RA-DIS', 1, 'Petit légume rouge et blanc, rond, au goût un peu piquant.')
  ], motMystere('CAMÉRA', 'CA-MÉ-RA', null, [
    'Appareil qui filme des images qui bougent.',
    'Le mot commence par CA.'
  ])),
  syllabes('syllabes-fr-ce1-ce2-04', 'fr', 'CE1-CE2', [
    syllabe('STYLO', 'STY-LO', 2, 'Objet rempli d\'encre qui sert à écrire.'),
    syllabe('COLIS', 'CO-LIS', 1, 'Paquet que l\'on envoie par la poste.'),
    syllabe('MOTO', 'MO-TO', 1, 'Véhicule à deux roues avec un moteur.', 'vocab_0457'),
    syllabe('TIGRE', 'TI-GRE', 1, 'Grand animal sauvage au pelage orange rayé de noir.'),
    syllabe('RÊVE', 'RÊ-VE', 2, 'Histoire que l\'on voit dans sa tête quand on dort.')
  ], motMystere('LOCOMOTIVE', 'LO-CO-MO-TI-VE', null, [
    'Machine qui tire les wagons d\'un train.',
    'Le mot commence par LO.'
  ])),

  // Français, CM1-CM2 (mots d'étape de 6 à 10 lettres)
  syllabes('syllabes-fr-cm1-cm2-01', 'fr', 'CM1-CM2', [
    syllabe('PAPIER', 'PA-PIER', 1, 'Matière mince faite à partir du bois, sur laquelle on écrit.'),
    syllabe('TRIMESTRE', 'TRI-MES-TRE', 1, 'Période de trois mois de l\'année scolaire.'),
    syllabe('MOITIÉ', 'MOI-TIÉ', 1, 'Chacune des deux parts égales d\'un tout.'),
    syllabe('SEMAINE', 'SE-MAI-NE', 3, 'Période de sept jours, du lundi au dimanche.')
  ], motMystere('PATRIMOINE', 'PA-TRI-MOI-NE', 'vocab_0363', [
    'Ce que nous avons reçu de nos ancêtres et que nous devons protéger : monuments, chants, savoir-faire.',
    'Le mot commence par PA.'
  ])),
  syllabes('syllabes-fr-cm1-cm2-02', 'fr', 'CM1-CM2', [
    syllabe('ÉCOLIER', 'É-CO-LIER', 1, 'Enfant qui va à l\'école primaire.'),
    // LECTEUR (vocab_0335, CM1-CM2) a les mêmes lettres : accepté (D9), il
    // donne la même syllabe LEC (règle 2 du §6.1 respectée)
    syllabe('LECTURE', 'LEC-TU-RE', 1, 'Action de lire un texte.', null, [reponse('LECTEUR', 'vocab_0335')]),
    syllabe('TRICOT', 'TRI-COT', 1, 'Vêtement chaud fait de laine, comme un pull.'),
    syllabe('CINÉMA', 'CI-NÉ-MA', 1, 'Salle où l\'on regarde des films sur un grand écran.'),
    syllabe('LIBERTÉ', 'LI-BER-TÉ', 3, 'Possibilité d\'agir et de penser sans être empêché injustement.', 'vocab_1290')
  ], motMystere('ÉLECTRICITÉ', 'É-LEC-TRI-CI-TÉ', null, [
    'Énergie qui allume les lampes et fait marcher les appareils.',
    'Le mot commence par É.'
  ])),
  syllabes('syllabes-fr-cm1-cm2-03', 'fr', 'CM1-CM2', [
    syllabe('VOLANT', 'VO-LANT', 1, 'Roue que le conducteur tourne pour diriger la voiture.'),
    syllabe('CANARD', 'CA-NARD', 1, 'Oiseau au bec plat et aux pattes palmées.'),
    syllabe('BUREAU', 'BU-REAU', 1, 'Table de travail, souvent avec des tiroirs.'),
    syllabe('LAITUE', 'LAI-TUE', 1, 'Salade verte aux grandes feuilles tendres.'),
    syllabe('NATURE', 'NA-TU-RE', 3, 'Tout ce qui existe sans avoir été fabriqué par l\'homme : plantes, animaux, eau, air.', 'vocab_0336')
  ], motMystere('VOCABULAIRE', 'VO-CA-BU-LAI-RE', null, [
    'Ensemble des mots d\'une langue, ou des mots que l\'on connaît.',
    'Le mot commence par VO.'
  ])),
  syllabes('syllabes-fr-cm1-cm2-04', 'fr', 'CM1-CM2', [
    syllabe('MOTEUR', 'MO-TEUR', 1, 'Machine qui fait avancer une voiture ou un camion.'),
    syllabe('NUMÉRO', 'NU-MÉ-RO', 1, 'Nombre qui sert à reconnaître une maison, un maillot ou une place.'),
    syllabe('CIMENT', 'CI-MENT', 2, 'Poudre grise que l\'on mélange avec de l\'eau et du sable pour construire.')
  ], motMystere('MONUMENT', 'MO-NU-MENT', null, [
    'Grande construction élevée pour garder le souvenir d\'une personne ou d\'un événement.',
    'Le mot commence par MO.'
  ])),

  // Anglais, SIL-CP (Class 1-2) : 2 parcours (I1 : MONDAY gardé)
  syllabes('syllabes-en-sil-cp-01', 'en', 'SIL-CP', [
    syllabe('SUNNY', 'SUN-NY', 1, 'The weather is like this when there are no clouds and it is bright and warm.'),
    syllabe('TODAY', 'TO-DAY', 2, 'Not yesterday, not tomorrow, but this very day.')
  ], motMystere('Sunday', 'SUN-DAY', null, [
    'The day of the week that comes after Saturday.',
    'The word begins with SUN.'
  ])),
  syllabes('syllabes-en-sil-cp-02', 'en', 'SIL-CP', [
    syllabe('MONEY', 'MON-EY', 1, 'Coins and notes that we use to buy things.'),
    syllabe('TODAY', 'TO-DAY', 2, 'Not yesterday, not tomorrow, but this very day.')
  ], motMystere('Monday', 'MON-DAY', null, [
    'The first school day of the week, after Sunday.',
    'The word begins with MON.'
  ])),

  // Anglais, CE1-CE2 (Class 3-4) : 3 parcours
  syllabes('syllabes-en-ce1-ce2-01', 'en', 'CE1-CE2', [
    syllabe('CARRY', 'CAR-RY', 1, 'To hold something and take it with you, like a bag on your back.'),
    syllabe('PENCIL', 'PEN-CIL', 1, 'We write and draw with it, and we can rub out its marks.'),
    syllabe('LETTER', 'LET-TER', 2, 'A, B and C are each one of these.')
  ], motMystere('CARPENTER', 'CAR-PEN-TER', 'vocab_0483', [
    'A person who makes things out of wood, like tables and doors.',
    'The word begins with CAR.'
  ])),
  syllabes('syllabes-en-ce1-ce2-02', 'en', 'CE1-CE2', [
    syllabe('BUTTON', 'BUT-TON', 1, 'A small round thing that we push through a hole to close a shirt.'),
    syllabe('WINTER', 'WIN-TER', 2, 'The coldest season of the year.', 'vocab_0516'),
    syllabe('FLYING', 'FLY-ING', 1, 'What a bird is doing when it moves through the air.')
  ], motMystere('BUTTERFLY', 'BUT-TER-FLY', 'vocab_1155', [
    'An insect with big colourful wings.',
    'The word begins with BUT.'
  ])),
  syllabes('syllabes-en-ce1-ce2-03', 'en', 'CE1-CE2', [
    syllabe('TODAY', 'TO-DAY', 1, 'The day we are in right now.'),
    syllabe('MORTAR', 'MOR-TAR', 1, 'A strong bowl in which we pound food with a heavy stick.'),
    syllabe('ARROW', 'AR-ROW', 2, 'A sign like this → that shows which way to go.')
  ], motMystere('TOMORROW', 'TO-MOR-ROW', null, [
    'The day that comes after this one.',
    'The word begins with TO.'
  ])),

  // Anglais, CM1-CM2 (Class 5-6) : 3 parcours
  syllabes('syllabes-en-cm1-cm2-01', 'en', 'CM1-CM2', [
    syllabe('INVENT', 'IN-VENT', 1, 'To create something new that did not exist before.'),
    syllabe('WINTER', 'WIN-TER', 2, 'The coldest season of the year, in some countries.'),
    syllabe('MAGNET', 'MAG-NET', 2, 'An object that attracts iron.', 'vocab_1326')
  ], motMystere('INTERNET', 'IN-TER-NET', 'vocab_0315', [
    'A worldwide network that lets computers share information.',
    'The word begins with IN.'
  ])),
  syllabes('syllabes-en-cm1-cm2-02', 'en', 'CM1-CM2', [
    syllabe('SUBJECT', 'SUB-JECT', 1, 'Maths, English and science are each one of these at school.'),
    syllabe('TRACTOR', 'TRAC-TOR', 1, 'A big, powerful farm machine with large back wheels.', 'vocab_0352'),
    syllabe('STATION', 'STA-TION', 2, 'A place where trains or buses stop for passengers.')
  ], motMystere('SUBTRACTION', 'SUB-TRAC-TION', 'vocab_0067', [
    'An operation that finds the difference between two numbers.',
    'The word begins with SUB.'
  ])),
  syllabes('syllabes-en-cm1-cm2-03', 'en', 'CM1-CM2', [
    syllabe('ATTEMPT', 'AT-TEMPT', 1, 'To try to do something difficult.'),
    syllabe('TENNIS', 'TEN-NIS', 1, 'A sport in which players hit a small ball over a net with rackets.', 'vocab_1501'),
    syllabe('LOTION', 'LO-TION', 2, 'A cream that we put on our skin to keep it soft.')
  ], motMystere('ATTENTION', 'AT-TEN-TION', null, [
    'When you listen and look carefully, you pay ___.',
    'The word begins with AT.'
  ]))
]

// --- Jeu 3 : Phrase secrète (24 parcours) ---

const JEU_3 = [
  // Français, SIL-CP (anagrammes de 3 à 5 lettres, première lettre placée)
  phraseJeu('phrase-secrete-fr-sil-cp-01', 'fr', 'SIL-CP', [
    mot('chat', 'Petit animal à moustaches qui miaule.', 'vocab_0913'),
    mot('dort', 'Le soir, bébé ferme les yeux : il ___ dans son lit.')
  ], phraseSecrete('Le chat dort.', ['Le'], ['Le chat dort.'], [
    'La phrase commence par Le.',
    'Le verbe est dort.'
  ])),
  phraseJeu('phrase-secrete-fr-sil-cp-02', 'fr', 'SIL-CP', [
    mot('Maman', 'Nom que l\'enfant donne à sa mère.'),
    mot('lave', 'Avec de l\'eau et du savon, je ___ mes mains.'),
    mot('pagne', 'Tissu coloré que l\'on noue autour du corps.', 'vocab_0997')
  ], phraseSecrete('Maman lave le pagne.', ['le'], ['Maman lave le pagne.'], [
    'La phrase commence par Maman.',
    'Le verbe est lave.'
  ])),
  phraseJeu('phrase-secrete-fr-sil-cp-03', 'fr', 'SIL-CP', [
    mot('mange', 'J\'ai faim : je ___ mon repas.'),
    mot('riz', 'Petits grains blancs que l\'on fait cuire dans l\'eau.', 'vocab_0879')
  ], phraseSecrete('Awa mange du riz.', ['Awa', 'du'], ['Awa mange du riz.'], [
    'La phrase commence par Awa.',
    'Le verbe est mange.'
  ])),
  phraseJeu('phrase-secrete-fr-sil-cp-04', 'fr', 'SIL-CP', [
    mot('Papa', 'Nom que l\'enfant donne à son père.'),
    mot('coupe', 'Avec un couteau, maman ___ le pain.'),
    mot('bois', 'Matière qui vient des arbres ; on en fait des tables.', 'vocab_0890')
  ], phraseSecrete('Papa coupe le bois.', ['le'], ['Papa coupe le bois.'], [
    'La phrase commence par Papa.',
    'Le verbe est coupe.'
  ])),

  // Français, CE1-CE2 (anagrammes de 4 à 7 lettres)
  phraseJeu('phrase-secrete-fr-ce1-ce2-01', 'fr', 'CE1-CE2', [
    mot('petit', 'Le contraire de grand.'),
    mot('garçon', 'Enfant qui deviendra un homme.'),
    mot('mange', 'J\'ai faim, alors je ___ mon repas.'),
    mot('banane', 'Fruit long et jaune que l\'on épluche.'),
    mot('mûre', 'Se dit d\'un fruit qui a fini de pousser et qui est bon à cueillir.')
  ], phraseSecrete('Le petit garçon mange une banane mûre.', ['Le', 'une'], ['Le petit garçon mange une banane mûre.'], [
    'La phrase commence par Le.',
    'Le verbe est mange.'
  ])),
  phraseJeu('phrase-secrete-fr-ce1-ce2-02', 'fr', 'CE1-CE2', [
    mot('tante', 'La sœur de ton père ou de ta mère.'),
    mot('prépare', 'Avant le repas, papa ___ la sauce dans la cuisine.'),
    // Autre sens dans le vocabulaire (vocab_0229, gros intestin) : non relié (I10)
    mot('gros', 'Le contraire de maigre.'),
    mot('gâteau', 'Pâtisserie sucrée que l\'on mange souvent pour un anniversaire.')
  ], phraseSecrete('Ma tante prépare un gros gâteau.', ['Ma', 'un'], ['Ma tante prépare un gros gâteau.'], [
    'La phrase commence par Ma.',
    'Le verbe est prépare.'
  ])),
  // Phrase 4 du contenu (« Dans la cour jouent les enfants. », sujet inversé)
  // retirée : refusée en CE1-CE2 (décision I13)
  phraseJeu('phrase-secrete-fr-ce1-ce2-03', 'fr', 'CE1-CE2', [
    mot('enfants', 'Les filles et les garçons qui ne sont pas encore des adultes.'),
    mot('jouent', 'À la récréation, les élèves ___ au ballon.'),
    mot('cour', 'Espace dehors, entouré de murs ou d\'une clôture, dans l\'école ou devant la maison.')
  ], phraseSecrete('Les enfants jouent dans la cour.', ['Les', 'dans', 'la'], [
    'Les enfants jouent dans la cour.',
    'Dans la cour, les enfants jouent.',
    'Les enfants, dans la cour, jouent.'
  ], [
    'La phrase commence par Les.',
    'Le verbe est jouent.'
  ])),
  phraseJeu('phrase-secrete-fr-ce1-ce2-04', 'fr', 'CE1-CE2', [
    mot('pêcheur', 'Personne qui attrape des poissons pour les vendre ou les manger.', 'vocab_0487'),
    mot('répare', 'Quand mon vélo est cassé, mon père le ___.'),
    mot('filet', 'Objet fait de fils et de trous, qui sert à attraper les poissons.')
  ], phraseSecrete('Le pêcheur répare son filet.', ['Le', 'son'], ['Le pêcheur répare son filet.'], [
    'La phrase commence par Le.',
    'Le verbe est répare.'
  ])),

  // Français, CM1-CM2 (anagrammes de 4 à 10 lettres, décision I3)
  phraseJeu('phrase-secrete-fr-cm1-cm2-01', 'fr', 'CM1-CM2', [
    mot('jour', 'Période de vingt-quatre heures.'),
    mot('menuisier', 'Artisan qui construit des meubles, des portes et des fenêtres.'),
    mot('fabrique', 'Avec des bouts de carton, Paul ___ lui-même un jouet.'),
    // Autre sens dans le vocabulaire (vocab_0060, table d'opérations) : non relié (I10)
    mot('table', 'Meuble à quatre pieds sur lequel on mange ou on travaille.'),
    mot('bois', 'Matière dure qui vient du tronc des arbres.')
  ], phraseSecrete('Chaque jour, le menuisier fabrique une table en bois.', ['Chaque', 'le', 'une', 'en'], [
    'Chaque jour, le menuisier fabrique une table en bois.',
    'Le menuisier fabrique une table en bois chaque jour.',
    'Le menuisier fabrique chaque jour une table en bois.',
    'Le menuisier, chaque jour, fabrique une table en bois.'
  ], [
    'La phrase commence par Chaque.',
    'Le verbe est fabrique.'
  ])),
  phraseJeu('phrase-secrete-fr-cm1-cm2-02', 'fr', 'CM1-CM2', [
    mot('saison', 'Chacune des grandes périodes de l\'année qui ont leur propre temps, comme la période sèche.'),
    mot('pluies', 'Eau qui tombe des nuages (le mot est au pluriel).'),
    mot('rivières', 'Cours d\'eau qui se jettent dans un fleuve (le mot est au pluriel).'),
    mot('débordent', 'Quand il y a trop d\'eau, les fleuves sortent de leur lit : ils ___.')
  ], phraseSecrete('Pendant la saison des pluies, les rivières débordent.', ['Pendant', 'la', 'des', 'les'], [
    'Pendant la saison des pluies, les rivières débordent.',
    'Les rivières débordent pendant la saison des pluies.',
    'Les rivières, pendant la saison des pluies, débordent.',
    // Sujet inversé, accepté en CM1-CM2 (décision I13)
    'Pendant la saison des pluies débordent les rivières.'
  ], [
    'La phrase commence par Pendant.',
    'Le verbe est débordent.'
  ])),
  phraseJeu('phrase-secrete-fr-cm1-cm2-03', 'fr', 'CM1-CM2', [
    mot('médecin', 'Personne qui a fait de longues études pour guérir les gens.'),
    mot('village', 'Petit groupe de maisons à la campagne.'),
    mot('soigne', 'L\'infirmière ___ la blessure : elle la nettoie et met un pansement.'),
    mot('malades', 'Personnes qui ne sont pas en bonne santé.')
  ], phraseSecrete('Le médecin du village soigne les malades.', ['Le', 'du', 'les'], [
    'Le médecin du village soigne les malades.',
    'Le médecin soigne les malades du village.'
  ], [
    'La phrase commence par Le.',
    'Le verbe est soigne.'
  ])),
  phraseJeu('phrase-secrete-fr-cm1-cm2-04', 'fr', 'CM1-CM2', [
    mot('fête', 'Moment de joie, en famille ou entre amis, pour célébrer un événement.'),
    mot('danseuse', 'Artiste qui bouge son corps en rythme sur la musique (au féminin).'),
    mot('porte', 'Il ___ un sac lourd sur son dos.'),
    mot('costume', 'Habit spécial que mettent les artistes pour un spectacle.'),
    mot('coloré', 'Qui a de nombreuses couleurs vives.')
  ], phraseSecrete('Pendant la fête, la danseuse porte un costume coloré.', ['Pendant', 'la', 'la', 'un'], [
    'Pendant la fête, la danseuse porte un costume coloré.',
    'La danseuse porte un costume coloré pendant la fête.',
    'La danseuse, pendant la fête, porte un costume coloré.',
    'La danseuse porte pendant la fête un costume coloré.'
  ], [
    'La phrase commence par Pendant.',
    'Le verbe est porte.'
  ])),

  // Anglais, SIL-CP (Class 1-2, anagrammes de 3 à 5 lettres, première lettre placée)
  phraseJeu('phrase-secrete-en-sil-cp-01', 'en', 'SIL-CP', [
    mot('sun', 'It shines in the sky during the day.'),
    mot('hot', 'The opposite of cold.')
  ], phraseSecrete('The sun is hot.', ['The', 'is'], ['The sun is hot.'], [
    'The sentence begins with The.',
    'The verb is is.'
  ])),
  phraseJeu('phrase-secrete-en-sil-cp-02', 'en', 'SIL-CP', [
    mot('Mum', 'Another word for mother.'),
    mot('cooks', 'In the kitchen, Dad ___ the dinner.'),
    mot('rice', 'Small white grains that we boil in water.', 'vocab_0879')
  ], phraseSecrete('Mum cooks rice.', [], ['Mum cooks rice.'], [
    'The sentence begins with Mum.',
    'The verb is cooks.'
  ])),
  phraseJeu('phrase-secrete-en-sil-cp-03', 'en', 'SIL-CP', [
    mot('bird', 'An animal with feathers, wings and a beak.', 'vocab_0916'),
    mot('fly', 'What a plane does in the sky.')
  ], phraseSecrete('The bird can fly.', ['The', 'can'], ['The bird can fly.'], [
    'The sentence begins with The.',
    'The verb is can fly.'
  ])),
  phraseJeu('phrase-secrete-en-sil-cp-04', 'en', 'SIL-CP', [
    mot('frog', 'A small green animal that lives near water and says "croak".'),
    mot('jumps', 'The rabbit ___ over the stick.')
  ], phraseSecrete('The frog jumps.', ['The'], ['The frog jumps.'], [
    'The sentence begins with The.',
    'The verb is jumps.'
  ])),

  // Anglais, CE1-CE2 (Class 3-4, anagrammes de 4 à 7 lettres)
  phraseJeu('phrase-secrete-en-ce1-ce2-01', 'en', 'CE1-CE2', [
    mot('drinks', 'When he is thirsty, Paul ___ some juice.'),
    mot('glass', 'A clear cup with no handle.'),
    mot('water', 'A clear liquid that comes out of the tap.')
  ], phraseSecrete('Awa drinks a glass of water.', ['Awa', 'a', 'of'], ['Awa drinks a glass of water.'], [
    'The sentence begins with Awa.',
    'The verb is drinks.'
  ])),
  phraseJeu('phrase-secrete-en-ce1-ce2-02', 'en', 'CE1-CE2', [
    mot('carries', 'Mum ___ the baby on her back.'),
    mot('heavy', 'Having a great weight, hard to lift.', 'vocab_1485'),
    mot('school', 'A place where children learn.', 'vocab_0596')
  ], phraseSecrete('Paul carries his heavy school bag.', ['Paul', 'his', 'bag'], ['Paul carries his heavy school bag.'], [
    'The sentence begins with Paul.',
    'The verb is carries.'
  ])),
  phraseJeu('phrase-secrete-en-ce1-ce2-03', 'en', 'CE1-CE2', [
    mot('wash', 'To clean with water and soap.', 'vocab_0686'),
    mot('hands', 'We have two of them, at the end of our arms, with five fingers each.'),
    mot('eating', 'Having a meal: putting food in your mouth and swallowing it.')
  ], phraseSecrete('We wash our hands before eating.', ['We', 'our', 'before'], [
    'We wash our hands before eating.',
    'Before eating, we wash our hands.',
    'We, before eating, wash our hands.'
  ], [
    'The sentence begins with We.',
    'The verb is wash.'
  ])),
  phraseJeu('phrase-secrete-en-ce1-ce2-04', 'en', 'CE1-CE2', [
    mot('Grandma', 'The mother of your mother or of your father.'),
    mot('tells', 'When Ali knows a secret, he ___ it to his best friend.'),
    mot('funny', 'Something that makes you laugh is ___.'),
    mot('story', 'A tale about people or animals, real or imagined.')
  ], phraseSecrete('Grandma tells us a funny story.', ['us', 'a'], ['Grandma tells us a funny story.'], [
    'The sentence begins with Grandma.',
    'The verb is tells.'
  ])),

  // Anglais, CM1-CM2 (Class 5-6, anagrammes de 4 à 10 lettres, décision I3)
  phraseJeu('phrase-secrete-en-cm1-cm2-01', 'en', 'CM1-CM2', [
    mot('rainy', 'Describes the weather when a lot of water falls from the clouds.'),
    mot('season', 'One of the long periods of the year, each with its own weather.'),
    mot('rivers', 'Large streams of water flowing towards the sea (plural).'),
    mot('overflow', 'To spill over the edges because there is too much water.')
  ], phraseSecrete('During the rainy season, many rivers overflow.', ['During', 'the', 'many'], [
    'During the rainy season, many rivers overflow.',
    'Many rivers overflow during the rainy season.',
    'Many rivers, during the rainy season, overflow.'
  ], [
    'The sentence begins with During.',
    'The verb is overflow.'
  ])),
  phraseJeu('phrase-secrete-en-cm1-cm2-02', 'en', 'CM1-CM2', [
    mot('musicians', 'People who make music with instruments or with their voices.'),
    // Autre sens dans le vocabulaire (vocab_0293, « take part in an activity
    // for fun ») : non relié (I10)
    mot('play', 'To make music with an instrument, for example the guitar.'),
    mot('balafon', 'An instrument of wooden bars struck with sticks.', 'vocab_1281'),
    mot('festival', 'A big event lasting several days with concerts and shows.', 'vocab_1277')
  ], phraseSecrete('The musicians play the balafon during the festival.', ['The', 'the', 'the', 'during'], [
    'The musicians play the balafon during the festival.',
    'During the festival, the musicians play the balafon.',
    'The musicians, during the festival, play the balafon.'
  ], [
    'The sentence begins with The.',
    'The verb is play.'
  ])),
  phraseJeu('phrase-secrete-en-cm1-cm2-03', 'en', 'CM1-CM2', [
    mot('Sleeping', 'Resting at night with your eyes closed.'),
    mot('mosquito', 'A small flying insect that bites; some kinds carry diseases.'),
    mot('helps', 'When Ali carries the heavy box with his father, he ___ him.'),
    mot('protect', 'A helmet can ___ your head when you ride a bike.', 'vocab_1241'),
    mot('malaria', 'A serious illness passed on by the bite of an infected insect.')
  ], phraseSecrete('Sleeping under a mosquito net helps protect us from malaria.', ['under', 'a', 'net', 'us', 'from'], [
    'Sleeping under a mosquito net helps protect us from malaria.'
  ], [
    'The sentence begins with Sleeping.',
    'The verb is helps.'
  ])),
  phraseJeu('phrase-secrete-en-cm1-cm2-04', 'en', 'CM1-CM2', [
    mot('sweep', 'To clean the floor with a broom.'),
    mot('classroom', 'The room where a teacher gives lessons to pupils.'),
    mot('Friday', 'The day of the week that comes before Saturday.'),
    mot('afternoon', 'The part of the day between midday and evening.')
  ], phraseSecrete('We sweep our classroom every Friday afternoon.', ['We', 'our', 'every'], [
    'We sweep our classroom every Friday afternoon.',
    'Every Friday afternoon, we sweep our classroom.',
    'We, every Friday afternoon, sweep our classroom.'
  ], [
    'The sentence begins with We.',
    'The verb is sweep.'
  ]))
]

// Les 44 parcours (20 du jeu 2, 24 du jeu 3)
export const PARCOURS_MYSTERES = Object.freeze([...JEU_2, ...JEU_3])
