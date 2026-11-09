// Premier lot des Grilles du maître (L16, phase 6) : fiches des 12 grilles
// et corrections acceptées par Isaac. Lu par scripts/grilles-maitre-import.js
// (importateur) et par src/utils/grillesMaitre.test.js.
//
// Source unique de ces informations (dépôt JARVIS) :
// DIBIE/jeux/grilles-du-maitre/selection-lot0-v0.1.md (VALIDÉ par Isaac le
// 2026-11-09) : composition du §7.2, niveaux (§2 et §6, Q2), rattachement au
// programme (§1.2), corrections C1, C3 à C18 (§3) et C25 à C32 (§7.3)
// acceptées en bloc (« Oui, tout »), C2 acceptée (« CHEVAL : corriger le
// texte », §6). Hors lot : C19 à C24, C33, C34 (grilles non retenues).
// Empreintes SHA-256 : relevé DIBIE/jeux/grilles-du-maitre/releve-grilles-2026-11-09.json.
//
// Une correction = un fragment exact du texte d'origine (`avant`) remplacé
// par `apres`, sur le mot désigné par sa réponse telle qu'écrite dans le
// fichier et son sens (across = horizontal, down = vertical). Les points de
// suspension « … » du document de sélection ne font pas partie des fragments.

const ACCEPTEE = 'acceptée par Isaac le 2026-11-09 (« Oui, tout »)'
const DROITS = {
  statut: 'déclarés par Isaac',
  date: '2026-11-09',
  reference: 'selection-lot0-v0.1.md §6, Q1 (« Ces grilles sont de moi ») ; en-tête Author du fichier'
}
const NIVEAU_CONFIRME = 'confirmé par Isaac le 2026-11-09'
const NIVEAU_PROPOSE = 'proposé par l\'educator, à confirmer par Isaac'
const PROGRAMME = ' (programmes-primaire-cameroun-v0.2.md, non confirmé par un enseignant)'

export const DATE_SELECTION = '2026-11-09'

export const SELECTION = [
  {
    id: 'G173', sha256: 'be8c3b511ec57b0835685ea417174c97f165bf0420486c67a6fbecf1b414d5b6',
    copies: [
      'J:\\DIBIE_SOURCES_A_ANALYSER\\03_DOC_OLEZOA\\pluriels des mots 3.ecw',
      'J:\\DOC DIBIE\\INFORMATIQUE\\NEW DOC DIBIE\\doc KWA\\NMI DOC\\PLURIEL DES MOTS\\pluriels des mots 3.ecw',
      'J:\\DOC DIBIE\\NMI DOC\\PLURIEL DES MOTS\\pluriels des mots 3.ecw'
    ],
    matiere: 'Français', theme: 'Orthographe : pluriel en -al / -ail', langue: 'fr',
    niveau: 'CM1-CM2', niveauStatut: NIVEAU_CONFIRME, classe: 'CM2',
    ligne_programme: 'CM2 : pluriel en -al / -ail' + PROGRAMME,
    corrections: [
      { id: 'C1', mot: 'JOURNAUX', direction: 'across', type: 'forme', avant: 'un journal, des', apres: 'Un journal, des', decision: ACCEPTEE }
    ]
  },
  {
    id: 'G172', sha256: '20976d052833f871d5f524b37c4a5ad8c244b0152535194257b5484758ff548a',
    copies: [
      'J:\\DIBIE_SOURCES_A_ANALYSER\\03_DOC_OLEZOA\\pluriels des mots 2.ecw',
      'J:\\DOC DIBIE\\INFORMATIQUE\\NEW DOC DIBIE\\doc KWA\\NMI DOC\\PLURIEL DES MOTS\\pluriels des mots 2.ecw',
      'J:\\DOC DIBIE\\NMI DOC\\PLURIEL DES MOTS\\pluriels des mots 2.ecw'
    ],
    matiere: 'Français', theme: 'Orthographe : pluriels en -eau, -ou, -eu, -ail, noms invariables', langue: 'fr',
    niveau: 'CM1-CM2', niveauStatut: NIVEAU_CONFIRME, classe: 'CM2',
    ligne_programme: 'CM2 : pluriel en -ail, -ou, -eu (aussi CE1 : pluriel des noms)' + PROGRAMME,
    corrections: [
      { id: 'C2', mot: 'CHEVAL', direction: 'across', type: 'réponse fausse (corrigée par le texte seul)', avant: 'Ce cheval, ces', apres: 'Ces chevaux, ce', decision: 'acceptée par Isaac le 2026-11-09 (« CHEVAL : corriger le texte »)', remarque: 'inverse le sens de l\'exercice pour ce mot (du pluriel vers le singulier)' },
      { id: 'C3', mot: 'SOURIS', direction: 'across', type: 'faute', avant: 'La souri, les', apres: 'La souris, les', decision: ACCEPTEE }
    ]
  },
  {
    id: 'G093', sha256: '093a43d0f743dc6814d0a236212ece52fad8f39148d4fe5229ae59ff4a094356',
    copies: [
      'J:\\DIBIE_SOURCES_A_ANALYSER\\03_DOC_OLEZOA\\Les mots qui se terminent par -ail, -aille, -eil, -eille,.ecw',
      'J:\\DOC DIBIE\\INFORMATIQUE\\NEW DOC DIBIE\\doc KWA\\NMI DOC\\TERMINAISON DES MOTS\\Les mots qui se terminent par -ail, -aille, -eil, -eille,.ecw',
      'J:\\DOC DIBIE\\NMI DOC\\TERMINAISON DES MOTS\\Les mots qui se terminent par -ail, -aille, -eil, -eille,.ecw'
    ],
    matiere: 'Français', theme: 'Orthographe : mots en -ail, -aille, -eil, -eille', langue: 'fr',
    niveau: 'CM1-CM2', niveauStatut: NIVEAU_CONFIRME,
    ligne_programme: 'CM2 : finales -ail, -eil' + PROGRAMME,
    corrections: [
      { id: 'C4', mot: 'DÉTAIL', direction: 'across', type: 'faute', avant: 'pétits', apres: 'petits', decision: ACCEPTEE }
    ]
  },
  {
    id: 'G085', sha256: 'b65c3fbb651dc61286cea4dc007d97fff2583fdacbdbf1660572df0cc71ba802',
    copies: [
      'J:\\DOC DIBIE\\INFORMATIQUE\\NEW DOC DIBIE\\doc KWA\\NMI DOC\\homophones et homographes\\les homonymes\\les homonymes plus 1.ecw',
      'J:\\DOC DIBIE\\NMI DOC\\homophones et homographes\\les homonymes\\les homonymes plus 1.ecw'
    ],
    matiere: 'Français', theme: 'Homophones (homonymes)', langue: 'fr',
    niveau: 'CM1-CM2', niveauStatut: NIVEAU_CONFIRME,
    ligne_programme: 'CM1 : homonymes ; CM2 : on/ont, la/là, peu/peut' + PROGRAMME,
    corrections: [
      { id: 'C5', mot: 'CE', direction: 'across', type: 'fautes', avant: 'm\'a couté un e fortune', apres: 'm\'a coûté une fortune', decision: ACCEPTEE },
      { id: 'C6', mot: 'MUR', direction: 'down', type: 'faute', avant: 'Berlin à été', apres: 'Berlin a été', decision: ACCEPTEE },
      { id: 'C7', mot: 'ÈRE', direction: 'down', type: 'faute', avant: 'L\' ......... chretienne', apres: 'L\'......... chrétienne', decision: ACCEPTEE },
      { id: 'C8', mot: 'BALADE', direction: 'down', type: 'faute', avant: 'famille etait en', apres: 'famille était en', decision: ACCEPTEE },
      { id: 'C9', mot: 'COR', direction: 'down', type: 'forme', avant: 'le ........ est  un', apres: 'Le ........ est un', decision: ACCEPTEE },
      { id: 'C9', mot: 'LA', direction: 'down', type: 'forme', avant: 'cette femme,', apres: 'Cette femme,', decision: ACCEPTEE },
      { id: 'C10', mot: 'AIRE', direction: 'down', type: 'ambiguë', avant: 'Cet homme a étendu son ........ dans la pièce.', apres: 'L\'........ d\'un rectangle est le produit de sa longueur par sa largeur.', decision: ACCEPTEE },
      { id: 'C11', mot: 'ERRE', direction: 'across', type: 'niveau de langue', avant: 'pauvre type', apres: 'pauvre homme', decision: ACCEPTEE },
      { id: 'C12', mot: 'CORPS', direction: 'across', type: 'contenu (facultative)', avant: 'On a retrouvé le ................ de la victime dans la rivière.', apres: 'Le squelette soutient le ................ humain.', decision: ACCEPTEE }
    ]
  },
  {
    id: 'G140', sha256: 'e07c28466d35eaf5c0057cf8b9a7dc228024cb968f52d6e440d20399169032e2',
    copies: [
      'J:\\DOC DIBIE\\INFORMATIQUE\\NEW DOC DIBIE\\doc KWA\\NMI DOC\\MOTS DE LA MEME FAMILLE\\MOTS DE LA MEME FAMILLE 1.ecw',
      'J:\\DOC DIBIE\\NMI DOC\\MOTS DE LA MEME FAMILLE\\MOTS DE LA MEME FAMILLE 1.ecw'
    ],
    matiere: 'Français', theme: 'Vocabulaire : familles de mots', langue: 'fr',
    niveau: 'CM1-CM2', niveauStatut: NIVEAU_CONFIRME,
    ligne_programme: 'CE1 : familles de mots (lexique des listes : niveau CM)' + PROGRAMME,
    corrections: [
      { id: 'C13', mot: 'LAVER', direction: 'across', type: 'mot tronqué', avant: 'avable, laveur', apres: 'lavable, laveur', decision: ACCEPTEE },
      { id: 'C14', mot: 'LONG', direction: 'across', type: 'mot tronqué', avant: 'onger, allonger', apres: 'longer, allonger', decision: ACCEPTEE },
      { id: 'C15', mot: 'CUISINE', direction: 'across', type: 'ambiguë', avant: 'cuisiner, cuisinier, cuisinière, cuisiné, cuire, recuire, cuisant, cuisson', apres: 'cuisiner, cuisinier, cuisinière, cuisiné', decision: ACCEPTEE, remarque: 'à confirmer par un enseignant (selection-lot0 §3)' }
    ]
  },
  {
    id: 'G183', sha256: 'b2208914d21b00a614ae7881217129883478a795a77edb39caef2c755e47857e',
    copies: ['J:\\LES CHAMPS LEXICAUX\\LIVRE CHAMPS LEXICAUX\\MALADIE\\Symptômes et sensations.ecw'],
    matiere: 'Sciences (santé) / vocabulaire', theme: 'Symptômes et sensations', langue: 'fr',
    niveau: 'CM1-CM2', niveauStatut: NIVEAU_CONFIRME,
    ligne_programme: 'CE1 : champ lexical « santé »' + PROGRAMME,
    corrections: [
      // Le document de sélection cite « qu'on » (apostrophe droite) ; le fichier
      // porte « qu’on » (apostrophe typographique). Le fragment s'arrête avant
      // l'apostrophe, qui reste celle du fichier.
      { id: 'C16', mot: 'FATIGUE', direction: 'down', type: 'réponse dans la définition', avant: 'Quand on est très fatigué et qu', apres: 'Quand on manque de force et qu', decision: ACCEPTEE, remarque: 'fragment arrêté avant l\'apostrophe : le document de sélection écrit « qu\'on », le fichier « qu’on »' }
    ]
  },
  {
    id: 'G180', sha256: '6f409ec4c3f68be66442fc13befd70f144221c36fbc56286ce6a591cb43bb7b1',
    copies: ['J:\\LES CHAMPS LEXICAUX\\LIVRE CHAMPS LEXICAUX\\MALADIE\\Soins et médicaments.ecw'],
    matiere: 'Sciences (santé) / vocabulaire', theme: 'Soins et médicaments', langue: 'fr',
    niveau: 'CE1-CE2', niveauStatut: NIVEAU_CONFIRME,
    ligne_programme: 'CE1 : champ lexical « santé »' + PROGRAMME,
    corrections: []
  },
  {
    id: 'G153', sha256: 'e9b58a845575dd797fcead2689b464f9ea3cbbdaafb7d1a8be61204098af03c3',
    copies: [
      'J:\\DOC USB\\Lecteur USB\\Lecteur USB\\TRANSFERT 2\\english verbs\\past tense of irregular verbs.ecw',
      'J:\\DOC USB\\Lecteur USB\\TRANSFERT 2\\english verbs\\past tense of irregular verbs.ecw'
    ],
    matiere: 'Anglais', theme: 'Grammaire : simple past des verbes irréguliers', langue: 'en',
    niveau: 'CM1-CM2', niveauStatut: NIVEAU_CONFIRME, classe: 'CM1', sous_systeme: 'francophone',
    ligne_programme: 'anglais en francophone : simple past des verbes irréguliers (CM1) ; anglophone : irregular verbs (Level II)' + PROGRAMME,
    corrections: [
      { id: 'C17', mot: 'THREW', direction: 'down', type: 'faute', avant: 'trhow', apres: 'throw', decision: ACCEPTEE },
      { id: 'C18', mot: 'WOUND', direction: 'down', type: 'ambiguë', avant: 'wind', apres: 'wind (a clock)', decision: ACCEPTEE }
    ]
  },
  {
    id: 'G168', sha256: '9a30f84c03e24ec52ed3b571f750210a491e17d6149e17b475d11ebdbcbaf8f6',
    copies: [
      'J:\\DIBIE_SOURCES_A_ANALYSER\\08_DIBIE_ANGLAIS\\PLURAL\\plural MCQ  2.ecw',
      'J:\\DOC DIBIE\\INFORMATIQUE\\NEW DOC DIBIE\\Dibiè ANGLAIS\\PLURAL\\plural MCQ  2.ecw',
      'J:\\Dibiè ANGLAIS\\PLURAL\\plural MCQ  2.ecw'
    ],
    matiere: 'Anglais', theme: 'Orthographe : pluriels', langue: 'en',
    niveau: 'CE1-CE2', niveauStatut: NIVEAU_CONFIRME,
    ligne_programme: 'anglais en francophone : pluriels s/es/ies (CE1) ; anglophone : plurals (Level I)' + PROGRAMME,
    droitsRemarque: 'extension de « Ces grilles sont de moi » aux plural MCQ : DÉDUITE par JARVIS, à confirmer par Isaac (selection-lot0 §6)',
    corrections: []
  },
  {
    id: 'G017', sha256: 'eaee6b61ad52eff3d5d70bcde6f8549e336bed92c2e6405fcb283823b4d61a4e',
    copies: [
      'J:\\DOC DIBIE\\INFORMATIQUE\\NEW DOC DIBIE\\doc KWA\\NMI DOC\\pack mots croisés\\addition subtraction word problem 1.ecw',
      'J:\\DOC DIBIE\\WORD MATHS PROBLEMS\\addition subtraction word problem 1.ecw'
    ],
    matiere: 'Mathématiques', theme: 'Problèmes d\'addition et de soustraction (résultats jusqu\'à 19)', langue: 'en',
    niveau: 'CE1-CE2', niveauStatut: NIVEAU_PROPOSE,
    corrections: [
      { id: 'C25', mot: 'EIGHT', direction: 'down', type: 'tournure', avant: 'Find the number of sisters Jack has?', apres: 'How many sisters does Jack have?', decision: ACCEPTEE },
      { id: 'C26', mot: 'SIXTEEN', direction: 'across', type: 'tournure', avant: 'How many books from parents did they get in all?', apres: 'How many books did they get from their parents in all?', decision: ACCEPTEE }
    ]
  },
  {
    id: 'G018', sha256: '3d3e231bd060c9b9176c4c9cfaa679bc86867a10cb445e7879dbae246f3d60f4',
    copies: [
      'J:\\DOC DIBIE\\INFORMATIQUE\\NEW DOC DIBIE\\doc KWA\\NMI DOC\\pack mots croisés\\addition subtraction word problem 2.ecw',
      'J:\\DOC DIBIE\\WORD MATHS PROBLEMS\\addition subtraction word problem 2.ecw'
    ],
    matiere: 'Mathématiques', theme: 'Problèmes d\'addition et de soustraction (résultats jusqu\'à 19)', langue: 'en',
    niveau: 'CE1-CE2', niveauStatut: NIVEAU_PROPOSE,
    corrections: [
      { id: 'C27', mot: 'EIGHTEEN', direction: 'down', type: 'calcul faux (corrigé par le texte seul)', avant: 'There are five black cars and eleven white cars', apres: 'There are seven black cars and eleven white cars', decision: ACCEPTEE },
      { id: 'C28', mot: 'NINE', direction: 'across', type: 'tournure', avant: 'Find  the number of sisters Peterson has?', apres: 'How many sisters does Peterson have?', decision: ACCEPTEE }
    ]
  },
  {
    id: 'G019', sha256: '8e10e78aede18b8df91fac72bec0bca3ba5c3713d8597b2cb92bc54d518e433a',
    copies: [
      'J:\\DOC DIBIE\\INFORMATIQUE\\NEW DOC DIBIE\\doc KWA\\NMI DOC\\pack mots croisés\\addition subtraction word problem 3.ecw',
      'J:\\DOC DIBIE\\WORD MATHS PROBLEMS\\addition subtraction word problem 3.ecw'
    ],
    matiere: 'Mathématiques', theme: 'Problèmes d\'addition et de soustraction (résultats jusqu\'à 20)', langue: 'en',
    niveau: 'CE1-CE2', niveauStatut: NIVEAU_PROPOSE,
    corrections: [
      { id: 'C29', mot: 'SEVEN', direction: 'across', type: 'calcul faux (corrigé par le texte seul)', avant: 'three black cars and three white cars', apres: 'three black cars and four white cars', decision: ACCEPTEE },
      { id: 'C30', mot: 'TEN', direction: 'across', type: 'faute', avant: 'visitord', apres: 'visitors', decision: ACCEPTEE },
      { id: 'C31', mot: 'SEVENTEEN', direction: 'down', type: 'faute', avant: 'at a the weekly market', apres: 'at the weekly market', decision: ACCEPTEE },
      { id: 'C32', mot: 'ELEVEN', direction: 'across', type: 'tournure', avant: 'Find the number of sisters Garry has?', apres: 'How many sisters does Garry have?', decision: ACCEPTEE }
    ]
  }
].map(fiche => ({
  ...fiche,
  statut: 'BROUILLON',
  droits: fiche.droitsRemarque ? { ...DROITS, remarque: fiche.droitsRemarque } : DROITS
}))
