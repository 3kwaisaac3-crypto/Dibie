// Réglages des jeux de calcul par classe et par sous-système (décision Q5
// d'Isaac du 2026-11-01 : les programmes francophone et anglophone diffèrent).
//
// TOUTES CES BORNES SONT PROVISOIRES (décision D4 : à valider par un enseignant
// de chaque sous-système). Elles sont reprises, sans invention, de :
//   DIBIE/pedagogie/programmes-primaire-cameroun-v0.2.md (dépôt JARVIS),
//   §2.1 (francophone), §2.2 (anglophone) et §5 (tableau de calibrage),
//   d'après les curricula MINEDUB de 2018 (copies non officielles, voir §0).
// Quand le document donne deux valeurs, la plus prudente (la plus petite) est
// retenue et signalée « À CONFIRMER ».
//
// Choix signalés, tous À CONFIRMER par un enseignant (D4) :
// - maxNumber sert de sommet aux pyramides additives : plus grand nombre de la
//   classe, et non les hypothèses de la fiche M2 du catalogue (« 10 puis 20 »,
//   « 100 puis 1 000 ») ; décision d'Isaac du 2026-11-03, fondée sur les livres
//   d'exercices de ces classes (information déclarée par Isaac, livres non
//   consultés par JARVIS) ;
// - CE1 et CE2 : seule la première borne du programme est retenue ; les suites
//   « puis nombres de 4 chiffres » (CE1) et « puis nombres de 5 chiffres » (CE2)
//   ne le sont pas ;
// - Class 3 et Class 4 : « bonds of 5s, 6s, 7s » et « bonds of 8 and 9 » sont
//   lus comme des tables de multiplication. INTERPRÉTATION FRAGILE : en anglais
//   scolaire, « number bonds » désigne souvent des décompositions additives
//   (7 = 3 + 4). Toute la multiplication en Class 3-4 en dépend : à confirmer
//   par un enseignant anglophone.
//
// Champs :
// - level : tranche de l'application (niveau du profil) ;
// - maxNumber : plus grand nombre étudié dans la classe ;
// - tables : tables de multiplication vues jusqu'à cette classe (cumul des
//   classes précédentes) ; [] si le programme ne les détaille pas ;
// - maxOperand : plus grand nombre par lequel on multiplie ou divise dans un
//   calcul (« par un nombre d'un chiffre » = 9 ; « de 2 chiffres » = 99) ;
//   null : pas de limite écrite dans le programme pour cette classe.

const fr = (className, level, maxNumber, tables, maxOperand, source) =>
  Object.freeze({ className, level, subsystem: 'fr', maxNumber, tables: Object.freeze(tables), maxOperand, source })
const en = (className, level, maxNumber, tables, maxOperand, source) =>
  Object.freeze({ className, level, subsystem: 'en', maxNumber, tables: Object.freeze(tables), maxOperand, source })

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

export const MATH_CLASSES = Object.freeze({
  fr: Object.freeze([
    // §2.1 SIL : « 0 à 20 » ; « résultats ≤ 5 puis ≤ 20 » ; « tables de multiplication par 1 et par 2 »
    fr('SIL', 'SIL-CP', 20, [1, 2], null, 'programmes v0.2 §2.1 et §5, SIL : nombres 0 à 20 ; tables ×1, ×2'),
    // §2.1 CP : « 20 à 100 » ; « tables par 2, 4 et 5 » ; « multiplication posée (résultat < 100) »
    fr('CP', 'SIL-CP', 100, [1, 2, 4, 5], null, 'programmes v0.2 §2.1 et §5, CP : nombres jusqu\'à 100 ; tables ×2, ×4, ×5'),
    // §2.1 CE1 : « 100 à 1 000, puis nombres de 4 chiffres (unité 8) » : 1 000 retenu,
    // la suite à 4 chiffres n'est pas retenue (À CONFIRMER) ; « tables par 3, 4 et 5 » ;
    // « multiplication par un nombre d'un chiffre ; division par un nombre d'un chiffre »
    fr('CE1', 'CE1-CE2', 1000, range(1, 5), 9, 'programmes v0.2 §2.1 et §5, CE1 : nombres jusqu\'à 1 000 ; tables ×3, ×4, ×5 ; multiplication et division par un nombre d\'un chiffre'),
    // §2.1 CE2 : « jusqu'à 10 000, puis nombres de 5 chiffres (unité 8) » : 10 000 retenu,
    // la suite à 5 chiffres n'est pas retenue (À CONFIRMER) ; « tables par 6, 7 et 8 » ;
    // « multiplication par un nombre de 2 chiffres ; division par un nombre de 2 chiffres »
    fr('CE2', 'CE1-CE2', 10000, range(1, 8), 99, 'programmes v0.2 §2.1 et §5, CE2 : nombres jusqu\'à 10 000 ; tables ×6, ×7, ×8 ; multiplication et division par un nombre de 2 chiffres'),
    // §2.1 CM1 : « grands nombres de 9 chiffres », avec la mention « nombres jusqu'au
    // million » dans le même texte : le million est retenu (plus prudent), À CONFIRMER
    // (§6, point 4) ; « tables de 1 à 10 »
    fr('CM1', 'CM1-CM2', 1000000, range(1, 10), null, 'programmes v0.2 §2.1 et §5, CM1 : nombres jusqu\'au million (ou 9 chiffres, à confirmer) ; tables de 1 à 10'),
    // §2.1 CM2 : « jusqu'à 12 chiffres (jusqu'au milliard) » : le milliard est retenu,
    // À CONFIRMER (§6, point 4) ; « tables de 1 à 10 + quelques multiplications par
    // 11 et 12 » : 11 et 12 ne sont pas retenus (« quelques »)
    fr('CM2', 'CM1-CM2', 1000000000, range(1, 10), null, 'programmes v0.2 §2.1 et §5, CM2 : nombres jusqu\'au milliard (à confirmer) ; tables de 1 à 10')
  ]),
  en: Object.freeze([
    // §2.2 Class 1 : « 0 à 100 » ; « les quatre opérations » ; tables non détaillées
    en('Class 1', 'SIL-CP', 100, [], null, 'programmes v0.2 §2.2 et §5, Class 1 : nombres 0 à 100 ; tables non détaillées'),
    // §2.2 Class 2 : « 100 à 200 » ; « build multiplication tables » (tables non détaillées)
    en('Class 2', 'SIL-CP', 200, [], null, 'programmes v0.2 §2.2 et §5, Class 2 : nombres jusqu\'à 200 ; « build multiplication tables », non détaillé'),
    // §2.2 Class 3 : « jusqu'à 500 ou 1 000 (cellule ambiguë) » : 500 retenu, À CONFIRMER
    // (§6, point 4) ; « bonds of 5s, 6s, 7s » lu comme tables jusqu'à 7 (INTERPRÉTATION
    // FRAGILE, voir l'en-tête ; à confirmer par un enseignant anglophone) ; diviseur non précisé : un chiffre (le plus prudent)
    en('Class 3', 'CE1-CE2', 500, range(1, 7), 9, 'programmes v0.2 §2.2 et §5, Class 3 : nombres jusqu\'à 500 (ou 1 000, à confirmer) ; « bonds of 5s, 6s, 7s » lu comme tables jusqu\'à 7 (interprétation)'),
    // §2.2 Class 4 : « 0 à 5 000 » ; « bonds of 8 and 9 » lu comme tables jusqu'à 9
    // (INTERPRÉTATION FRAGILE, voir l'en-tête ; à confirmer par un enseignant anglophone) ; diviseur non précisé : un chiffre (le plus prudent)
    en('Class 4', 'CE1-CE2', 5000, range(1, 9), 9, 'programmes v0.2 §2.2 et §5, Class 4 : nombres jusqu\'à 5 000 ; « bonds of 8 and 9 » lu comme tables jusqu\'à 9 (interprétation)'),
    // §2.2 Class 5 : « 0 à 100 000 » ; « tables » ; §5 : tables 1 à 10
    en('Class 5', 'CM1-CM2', 100000, range(1, 10), null, 'programmes v0.2 §2.2 et §5, Class 5 : nombres jusqu\'à 100 000 ; tables de 1 à 10'),
    // §2.2 Class 6 : « 0 à 1 000 000 » ; §5 : tables 1 à 10
    en('Class 6', 'CM1-CM2', 1000000, range(1, 10), null, 'programmes v0.2 §2.2 et §5, Class 6 : nombres jusqu\'à 1 000 000 ; tables de 1 à 10')
  ])
})

export const MATH_SUBSYSTEMS = Object.freeze(Object.keys(MATH_CLASSES))

// Réglages d'une classe, ou null
export function mathClassSettings(className, subsystem) {
  return MATH_CLASSES[subsystem]?.find(c => c.className === className) ?? null
}

// Classe utilisée pour régler un jeu de calcul (décision Q5) : la classe du
// profil si elle appartient à son niveau et à son sous-système ; sinon la
// première classe de la tranche, la plus prudente. Sous-système absent ou
// inconnu : francophone (valeur par défaut des profils, src/db/index.js).
// Renvoie { settings, isDefault, reason } ; isDefault vrai si la classe n'est
// pas celle du profil ; reason : null, 'no-class' (profil sans classe) ou
// 'mismatch' (classe qui n'appartient pas au niveau ou au sous-système du profil).
export function resolveMathClass({ level, className = null, subsystem = 'fr' } = {}) {
  const sub = MATH_CLASSES[subsystem] ? subsystem : 'fr'
  const own = MATH_CLASSES[sub].find(c => c.className === className && c.level === level)
  if (own) return { settings: own, isDefault: false, reason: null }
  const first = MATH_CLASSES[sub].find(c => c.level === level) ?? MATH_CLASSES[sub][0]
  const hasClass = typeof className === 'string' && className !== ''
  return { settings: first, isDefault: true, reason: hasClass ? 'mismatch' : 'no-class' }
}
