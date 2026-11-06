# Jeux de paires (moteur C) : note de conception du lot A

- **Date** : 2026-11-06
- **Statut** : lot A réalisé sur la branche `feature/paires-lot-a` (depuis `main` = `1b53a18`), non commité à la rédaction. Non validé par un enseignant (démonstration seulement).
- **Source des règles** : `DIBIE/pedagogie/cadrage-phase4-paires-v0.1.md` (dépôt JARVIS), décisions P1 à P12 validées par Isaac le 2026-11-06 ; fiche L3 du catalogue des jeux v0.2.

## 1. Fichiers

| Fichier | Rôle |
|---|---|
| `src/utils/pairsGame.js` | Moteur pur : clés de comparaison, tirage avec graine, unicité, état de partie (paires trouvées / montrées, erreurs par élément), points ; préparation L3 |
| `src/utils/pairsGame.test.js` | Tests unitaires (16) |
| `src/pages/PairsGame.jsx`, `src/styles/PairsGame.css` | Jeu L3 « Associations FR ↔ EN » (conteneurs et boutons repris de `AnagramGame.css`) |
| `src/App.jsx`, `src/pages/StudentDashboard.jsx` | Page `pairsGame`, carte « Associations FR ↔ EN » |
| `e2e/paires.spec.js` | Tests navigateur (6 tests × 3 projets) |

## 2. Moteur générique

Le moteur reçoit des **candidats** `{ id, keys, restricted, ... }`. Deux candidats qui partagent une clé ne vont jamais dans la même partie (P12 a, strict). `restricted` limite le nombre de candidats d'un type par partie (`maxRestricted`).

- **Tirage** (`selectPairs`) : tri par id, mélange selon la graine (`createRandom`, `shuffled`), choix glouton ; si ce choix ne suffit pas, même ordre avec les candidats non restreints d'abord.
- **Jouable** (`guaranteedPairCount`) : nombre de paires obtenu pour **toute** graine = une par groupe de candidats reliés par des clés communes contenant un candidat non restreint, plus `maxRestricted` groupes faits uniquement de candidats restreints. Un sujet est grisé si ce nombre est inférieur au nombre de paires du niveau : un sujet proposé donne toujours une partie complète, quel que soit le numéro.
- **Colonne de droite** : mélangée ; si son ordre est identique à celui de gauche, décalée d'un cran (sinon les paires se liraient ligne à ligne).
- **État** : `tryMatch`, `canHint` (2 erreurs), `canShowAnswer` (3 erreurs), `showAnswer`, `focusAfterWrong`, `pairsScore` (10 points par paire trouvée).

Prévu pour L6, M7 et L4 : il suffira d'écrire leur préparation de candidats (clés : produits pour M7, définitions pour L4).

## 3. Règles de L3

| Règle | Mise en œuvre |
|---|---|
| P3 | 3 / 5 / 6 paires (`TRANSLATION_SETTINGS`) |
| P4 | niveau + matière + sujet ; sujets injouables grisés, mention « pas assez de mots » |
| P5 | gauche = langue de l'interface au lancement. **Mêmes paires en FR et en EN pour un même numéro** : les mots de chaque langue changent de colonne et d'ordre (l'ordre des lignes est gardé) |
| P6 | mauvaise paire : les deux mots tremblent, restent libres, une erreur comptée pour chacun ; 2 erreurs : indice ; 3 erreurs : « Voir la réponse » (0 point, `isCorrect: false`) |
| P7 | pas d'étoiles, pas de badge ; `gameType` = `pairsTranslation` |
| P8 | majuscules des deux côtés, accents gardés, première forme de « A / B », espaces gardés (`displayText`, pas `sanitizeWord`) |
| P11 b | au plus 1 paire dont le mot FR et la première forme EN ont la même clé : 245 entrées actives selon la clé du moteur (les 244 du cadrage + CLIPART / « Clip art », l'espace étant ignoré) |
| P12 a | clés : **toutes** les formes FR et EN dans un même espace (aussi d'une langue à l'autre : pas de « COIN » FR et « Coin » EN pour deux paires) ; définitions FR et EN (pas deux indices identiques) |

Clé de comparaison (`pairKey`) : majuscules, sans accents, ligatures développées, seulement lettres et chiffres.

Enregistrement : `saveUserProgress(userId, id, isCorrect, null, { gameType: 'pairsTranslation', itemId: id })` par paire résolue ; `saveScore(userId, 'pairsTranslation', score, niveau, { seed, language, subject, pairCount })` **une seule fois, dès que la dernière paire est résolue** (trouvée ou montrée) : « Retour » ou « Nouvelle partie » ne font pas perdre le score ; « Terminer » affiche le récapitulatif sans réenregistrer (correction validée par Isaac le 2026-11-06 après la relecture du reviewer).

## 4. Choix provisoires du developer (à valider par Isaac)

1. **Indice = définition dans la langue de l'élément** (mot français : `def_fr` ; mot anglais : `def_en`). Raison : une définition dans la même langue que le mot explique son sens sans donner directement le mot de l'autre colonne. L'indice porte sur le mot qui a le plus d'erreurs dans la dernière mauvaise paire (celui de gauche à égalité), ou sur le mot touché.
2. Nom du `gameType` : `pairsTranslation` (prévus : `pairsDefinition`, `pairsMemory`, `pairsMultiplication`).
3. Contrôle des formes d'une langue à l'autre et des définitions identiques (plus strict que les 17 collisions du cadrage).
4. On peut commencer par l'une ou l'autre colonne ; toucher à nouveau le mot choisi l'annule.
5. Couleurs : 8 couleurs, plus un numéro de paire sur les deux mots (pour les élèves qui distinguent mal les couleurs) ; réponse montrée en bordure à tirets.
6. Score enregistré automatiquement à la dernière paire ; le récapitulatif s'affiche au bouton « Terminer » (comme les anagrammes), sans enchaînement automatique.
7. Sujets jouables avec ces règles : SIL-CP 23/23, CE1-CE2 31/33, CM1-CM2 38/51.

## 5. Limites

- Aucun essai sur un vrai téléphone (seulement Playwright à 375 px et 320 px).
- Réglages et traductions au statut brouillon ; enseignant non désigné (Q7).
- Pas de glisser-déposer (toucher puis toucher seulement).
