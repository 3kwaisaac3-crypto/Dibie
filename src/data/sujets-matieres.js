// Accès par matière, sans modifier vocabulaire.json (décision D12).
// Classement repris de docs/audit-architecture.md, annexe A : validé par Isaac
// le 2026-11-02, À VALIDER ensuite par un enseignant. Un sujet absent de la table
// (autre sujet du vocabulaire, sujet importé) reste accessible sous « Autres ».

import { matchesDomain } from '../utils/crosswordLayout.js'

const SUJETS_PAR_MATIERE = {
  maths: [
    'Addition', 'Angles', 'Calcul', 'Cercle', 'Comparaison', 'Division', 'Droites', 'Finance',
    'Fractions', 'Géométrie', 'Mathématiques', 'Mesures', 'Mesures / Géométrie', 'Mesures du temps',
    'Multiplication', 'Nombres', 'Nombres décimaux', 'Numération', 'Opérations', 'Polygones',
    'Problèmes', 'Problèmes / Finance', 'Proportionnalité', 'Quadrilatères', 'Repérage',
    'Représentation des données', 'Segments', 'Solides', 'Soustraction', 'Symétrie',
    'Transformations', 'Triangles'
  ],
  sciences: [
    'Sciences', 'Sciences / Mathématiques', 'Digestion', 'Matière', 'Matière / États',
    'Matière / Mélanges', 'Corps humain', 'Climat', 'Nature', 'Environnement', 'Santé',
    'Santé / Hygiène', 'Hygiène', 'Saisons'
  ],
  tic: [
    'Informatique', 'Internet', 'Logiciels', 'Matériel informatique', 'TIC', 'Technologie',
    'Utilisation de l’ordinateur'
  ]
}

// Table sujet → matière. Map : un sujet importé ne peut pas tomber sur une
// propriété héritée d'objet (« constructor »).
const SUJET_MATIERE = new Map(
  Object.entries(SUJETS_PAR_MATIERE).flatMap(([matiere, sujets]) => sujets.map(sujet => [sujet, matiere]))
)

export const MATIERE_TOUTES = 'toutes'
export const MATIERE_AUTRES = 'autres'

// Choix du filtre, dans l'ordre d'affichage
export const MATIERES = [
  { id: MATIERE_TOUTES, fr: 'Toutes', en: 'All' },
  { id: 'maths', fr: 'Mathématiques', en: 'Mathematics' },
  { id: 'sciences', fr: 'Sciences et santé', en: 'Science and health' },
  { id: 'tic', fr: 'Informatique et TIC', en: 'Computing and ICT' },
  { id: MATIERE_AUTRES, fr: 'Autres', en: 'Other' }
]

// Traduction anglaise des 94 sujets : PROPOSITION de JARVIS, à valider par
// Isaac et un enseignant. Affichage seulement : la valeur interne reste le nom français.
export const SUJET_EN = new Map([
  ['Addition', 'Addition'],
  ['Agriculture', 'Agriculture'],
  ['Alimentation', 'Food'],
  ['Angles', 'Angles'],
  ['Animaux', 'Animals'],
  ['Appareils ménagers', 'Household appliances'],
  ['Bricolage', 'DIY'],
  ['Calcul', 'Calculation'],
  ['Cercle', 'Circle'],
  ['Chambre', 'Bedroom'],
  ['Climat', 'Climate'],
  ['Commerce', 'Trade'],
  ['Comparaison', 'Comparison'],
  ['Corps humain', 'Human body'],
  ['Couleurs', 'Colours'],
  ['Cuisine', 'Kitchen and cooking'],
  ['Culture', 'Culture'],
  ['Danse', 'Dance'],
  ['Digestion', 'Digestion'],
  ['Division', 'Division'],
  ['Droites', 'Lines'],
  ['École', 'School'],
  ['Éducation', 'Education'],
  ['Éducation civique', 'Civic education'],
  ['Environnement', 'Environment'],
  ['Finance', 'Finance'],
  ['Fractions', 'Fractions'],
  ['Fruits', 'Fruit'],
  ['Géographie', 'Geography'],
  ['Géométrie', 'Geometry'],
  ['Grammaire / Déterminants', 'Grammar / Determiners'],
  ['Histoire', 'History'],
  ['Hygiène', 'Hygiene'],
  ['Informatique', 'Computing'],
  ['Internet', 'Internet'],
  ['Jardinage', 'Gardening'],
  ['Jeux', 'Games'],
  ['Jouets', 'Toys'],
  ['Légumes', 'Vegetables'],
  ['Lessive', 'Laundry'],
  ['Logiciels', 'Software'],
  ['Maison', 'Home'],
  ['Maison / Agriculture', 'Home / Agriculture'],
  ['Matériel informatique', 'Computer hardware'],
  ['Mathématiques', 'Mathematics'],
  ['Matière', 'Matter'],
  ['Matière / États', 'Matter / States'],
  ['Matière / Mélanges', 'Matter / Mixtures'],
  ['Mesures', 'Measurement'],
  ['Mesures / Géométrie', 'Measurement / Geometry'],
  ['Mesures du temps', 'Measuring time'],
  ['Métiers', 'Jobs'],
  ['Métiers / Artisanat', 'Jobs / Crafts'],
  ['Métiers / Santé', 'Jobs / Health'],
  ['Multiplication', 'Multiplication'],
  ['Musique', 'Music'],
  ['Musique / Culture', 'Music / Culture'],
  ['Nature', 'Nature'],
  ['Nettoyage', 'Cleaning'],
  ['Nombres', 'Numbers'],
  ['Nombres décimaux', 'Decimal numbers'],
  ['Numération', 'Number system'],
  ['Opérations', 'Operations'],
  ['Petits mots', 'Short words'],
  ['Polygones', 'Polygons'],
  ['Problèmes', 'Word problems'],
  ['Problèmes / Finance', 'Word problems / Finance'],
  ['Proportionnalité', 'Proportionality'],
  ['Quadrilatères', 'Quadrilaterals'],
  ['Repérage', 'Coordinates'],
  ['Représentation des données', 'Data representation'],
  ['Saisons', 'Seasons'],
  ['Santé', 'Health'],
  ['Santé / Hygiène', 'Health / Hygiene'],
  ['Sciences', 'Science'],
  ['Sciences / Mathématiques', 'Science / Mathematics'],
  ['Sécurité routière', 'Road safety'],
  ['Segments', 'Line segments'],
  ['Services', 'Services'],
  ['Société', 'Society'],
  ['Solides', 'Solids'],
  ['Soustraction', 'Subtraction'],
  ['Sport', 'Sport'],
  ['Symétrie', 'Symmetry'],
  ['Technologie', 'Technology'],
  ['TIC', 'ICT'],
  ['Transformations', 'Transformations'],
  ['Transport', 'Transport'],
  ['Triangles', 'Triangles'],
  ['Ustensiles de cuisine', 'Kitchen utensils'],
  ['Utilisation de l’ordinateur', 'Using a computer'],
  ['Vaisselle', 'Dishes'],
  ['Vêtements', 'Clothes'],
  ['Ville', 'Town']
])

// Matière d'un sujet ; « autres » s'il n'est pas dans la table
export const matiereDuSujet = (sujet) => SUJET_MATIERE.get(sujet) ?? MATIERE_AUTRES

// Sujets de la table, pour les contrôles
export const sujetsDeLaTable = () => [...SUJET_MATIERE.keys()]

// Filtre une liste d'objets { subject } selon la matière choisie
export const filtrerParMatiere = (liste, matiere) =>
  matiere === MATIERE_TOUTES ? liste : liste.filter(s => matiereDuSujet(s.subject) === matiere)

// Nom affiché d'un sujet ; en anglais, repli sur le nom français s'il n'a pas de traduction
export const libelleSujet = (sujet, language) =>
  (language === 'fr' ? sujet : SUJET_EN.get(sujet) ?? sujet)

// Domaine à afficher dans le titre d'une grille. La grille française écarte déjà
// tout mot égal au sujet, mais un titre traduit peut donner la réponse (GEOMETRY) :
// si un mot placé lui correspond, pas de domaine dans le titre (décision d'Isaac du 2026-11-02).
export const titreDeGrille = (game, sujet, language) => {
  const titre = libelleSujet(sujet, language)
  return game.placements.some(p => matchesDomain(p.word, titre)) ? undefined : titre
}

export const libelleMatiere = (id, language) => {
  const matiere = MATIERES.find(m => m.id === id)
  return matiere ? matiere[language === 'fr' ? 'fr' : 'en'] : id
}
