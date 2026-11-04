// Liste fixe des thèmes du jeu 4 « Mystère des thèmes » (anagrammes mystères,
// docs/anagrammes-mysteres.md §3 et §6.2 règle 3 ; décision M6 d'Isaac du
// 2026-11-03 : réponse par choix parmi 4 propositions).
//
// Source : « Thèmes du Mystère des thèmes — v0.1 » (DIBIE/contenus/
// themes-mysteres-v0.1.md du dépôt JARVIS), proposée par l'educator le
// 2026-11-03 et VALIDÉE PAR ISAAC le 2026-11-03. Elle reste À VALIDER PAR UN
// ENSEIGNANT (non encore désigné, Q7).
//
// Le jeu 4 ne lit QUE ce fichier : un programme ne peut pas prouver qu'un mot
// n'appartient pas à une proposition fausse (les sujets du vocabulaire se
// recouvrent : SOL est à la fois Environnement et Musique). Chaque couple
// « thème, propositions fausses » est donc relu.
//
// Format d'un thème :
// {
//   id,                 // identifiant stable (minuscules, sans accent)
//   sujets: [...],      // valeurs exactes du champ `sujet` de vocabulaire.json
//   label: { fr, en },  // nom du thème montré à l'élève (bonne proposition)
//   distractors: [{ fr, en }, { fr, en }, { fr, en }], // 3 propositions fausses :
//                       // libellés d'autres thèmes du même niveau (règle R3)
//   excludedWords: { fr: [...], en: [...] },  // mots du thème à ne jamais
//                       // proposer (choix pédagogiques de l'educator), comparés
//                       // après normalisation (majuscules sans accents)
//   status              // voir THEME_STATUSES
// }
//
// Règles de l'educator appliquées par le générateur (mysteryGenerators.js) et
// contrôlées par mysteryValidation.js :
// - R1 : une étape est écartée si une autre anagramme acceptée n'appartient
//   pas au thème. Le générateur va plus loin : il écarte TOUT mot qui a une
//   autre anagramme dans le vocabulaire, car l'élément gagné est le mot
//   lui-même et deux réponses donneraient deux éléments différents (§6.1, règle 2) ;
// - R2 : le libellé du thème (et ses formes dérivées) n'apparaît dans aucun mot
//   d'étape ni dans sa définition, dans la langue de la partie ;
// - R3 : les propositions fausses sont des libellés de thèmes du même niveau.
// Un thème qui n'a pas assez de mots utilisables pour un parcours est retiré
// automatiquement (availableThemes).
//
// Affectation des mots écartés : chaque mot de la liste de l'educator est
// rattaché aux thèmes dont il relève dans le vocabulaire (niveau, langue,
// sujet). Exceptions, selon le motif donné par l'educator : JEU et GAME
// (« libellé repris ») seulement pour les jeux et jouets ; PAIN seulement en
// anglais (douleur, CE1-CE2), le PAIN français (aliment) reste ; DOCTEUR,
// DOCTOR, ONGLE et SANG seulement pour la santé, où ils relèvent d'un autre thème.

// draft : non relu ; isaac-validated : validé par Isaac, À VALIDER par un
// enseignant ; validated : validé par un enseignant
export const THEME_STATUSES = Object.freeze(['draft', 'isaac-validated', 'validated'])

export const THEMES_MYSTERES_VERSION = 'v0.1' // version de la liste de l'educator

const L = {
  animaux: { fr: 'Les animaux', en: 'Animals' },
  corps: { fr: 'Le corps humain', en: 'The human body' },
  couleurs: { fr: 'Les couleurs', en: 'Colours' },
  vetements: { fr: 'Les vêtements', en: 'Clothes' },
  ecole: { fr: 'L\'école', en: 'School' },
  jeux: { fr: 'Les jeux et les jouets', en: 'Games and toys' },
  fruits: { fr: 'Les fruits et légumes', en: 'Fruit and vegetables' },
  cuisine: { fr: 'La cuisine', en: 'The kitchen' },
  transports: { fr: 'Les transports', en: 'Transport' },
  metiers: { fr: 'Les métiers', en: 'Jobs' },
  musique: { fr: 'La musique', en: 'Music' },
  ordinateur: { fr: 'L\'ordinateur', en: 'The computer' },
  aliments: { fr: 'Les aliments', en: 'Food' },
  sante: { fr: 'La santé et l\'hygiène', en: 'Health and hygiene' },
  sport: { fr: 'Le sport', en: 'Sport' },
  artisans: { fr: 'Les artisans', en: 'Craftspeople' },
  informatique: { fr: 'L\'informatique', en: 'Computing' },
  formes: { fr: 'Les formes géométriques', en: 'Shapes' },
  agriculture: { fr: 'L\'agriculture', en: 'Farming' },
  geographie: { fr: 'La géographie', en: 'Geography' },
  digestion: { fr: 'La digestion', en: 'Digestion' }
}

const theme = (id, sujets, label, distractors, excludedWords = {}) => Object.freeze({
  id,
  sujets: Object.freeze(sujets),
  label: Object.freeze(label),
  distractors: Object.freeze(distractors.map(d => Object.freeze({ ...d }))),
  excludedWords: Object.freeze({ fr: Object.freeze(excludedWords.fr ?? []), en: Object.freeze(excludedWords.en ?? []) }),
  status: 'isaac-validated'
})

export const THEMES_MYSTERES = Object.freeze({
  // SIL-CP (3 à 5 lettres) : 8 thèmes
  'SIL-CP': Object.freeze([
    theme('animaux', ['Animaux'], L.animaux, [L.couleurs, L.vetements, L.ecole]),
    theme('corps-humain', ['Corps humain'], L.corps, [L.couleurs, L.cuisine, L.ecole]),
    theme('couleurs', ['Couleurs'], L.couleurs, [L.animaux, L.cuisine, L.ecole]),
    theme('vetements', ['Vêtements'], L.vetements, [L.animaux, L.cuisine, L.fruits], { fr: ['POCHE'] }),
    theme('ecole', ['École'], L.ecole, [L.animaux, L.vetements, L.fruits], { fr: ['ECOLE'], en: ['PUPIL'] }),
    theme('jeux-jouets', ['Jeux', 'Jouets'], L.jeux, [L.couleurs, L.cuisine, L.fruits],
      { fr: ['JEU', 'COURSE', 'JOUER', 'RIRE'], en: ['GAME', 'PLAY', 'RUN'] }),
    theme('fruits-legumes', ['Fruits', 'Légumes'], L.fruits, [L.corps, L.vetements, L.ecole]),
    theme('cuisine', ['Cuisine', 'Ustensiles de cuisine', 'Vaisselle'], L.cuisine, [L.animaux, L.corps, L.vetements],
      { fr: ['FEU', 'BOIRE'] })
  ]),
  // CE1-CE2 (4 à 7 lettres) : 7 thèmes
  'CE1-CE2': Object.freeze([
    theme('animaux', ['Animaux'], L.animaux, [L.transports, L.musique, L.ordinateur]),
    theme('transports', ['Transport'], L.transports, [L.animaux, L.musique, L.sante],
      { fr: ['PORT', 'VOLANT'], en: ['PORT'] }),
    theme('metiers', ['Métiers', 'Métiers / Santé'], L.metiers, [L.animaux, L.musique, L.ordinateur]),
    theme('musique', ['Musique'], L.musique, [L.animaux, L.transports, L.aliments],
      { fr: ['JOUER'], en: ['HORN', 'PLAY'] }),
    theme('ordinateur', ['Informatique', 'Internet', 'Logiciels', 'Matériel informatique', 'Utilisation de l’ordinateur'],
      L.ordinateur, [L.transports, L.aliments, L.sante], { fr: ['SOURIS'] }),
    theme('aliments', ['Alimentation'], L.aliments, [L.transports, L.musique, L.ordinateur]),
    theme('sante-hygiene', ['Santé', 'Hygiène', 'Santé / Hygiène'], L.sante, [L.transports, L.musique, L.ordinateur],
      { fr: ['LAVER', 'DOCTEUR', 'ONGLE', 'SANG'], en: ['HEALTHY', 'CARE', 'PAIN', 'WASH', 'DOCTOR'] })
  ]),
  // CM1-CM2 (6 à 10 lettres) : 7 thèmes
  'CM1-CM2': Object.freeze([
    theme('sport', ['Sport'], L.sport, [L.artisans, L.informatique, L.agriculture],
      { fr: ['COURSE', 'DISCIPLINE', 'JOUER'], en: ['DISCIPLINE', 'PLAY'] }),
    theme('artisans', ['Métiers / Artisanat'], L.artisans, [L.sport, L.informatique, L.digestion], { fr: ['SERRURERIE'] }),
    theme('informatique', ['TIC', 'Informatique', 'Internet'], L.informatique, [L.sport, L.artisans, L.agriculture],
      { fr: ['SOURIS', 'SERVEUR'] }),
    theme('formes-geometriques', ['Polygones', 'Quadrilatères', 'Solides'], L.formes, [L.sport, L.agriculture, L.digestion],
      { fr: ['SOLIDE', 'PATRON', 'ARETES', 'TRAPEZE'], en: ['SQUARE'] }),
    theme('agriculture', ['Agriculture'], L.agriculture, [L.sport, L.informatique, L.formes], { fr: ['CULTURE'] }),
    theme('geographie', ['Géographie'], L.geographie, [L.sport, L.informatique, L.digestion]),
    theme('digestion', ['Digestion'], L.digestion, [L.informatique, L.geographie, L.artisans],
      { fr: ['DIGESTION'], en: ['DIGESTION'] })
  ])
})
