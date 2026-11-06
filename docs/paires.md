# Jeux de paires (moteur C) : note de conception des lots A et B

- **Date** : 2026-11-06
- **Statut** : lot A fusionné dans `main` (pull request n° 21, commit de fusion `59e9e22`). Non validé par un enseignant (démonstration seulement).
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

---

# Lot B : mémoire FR ↔ EN (L6) et mémoire des tables (M7)

- **Date** : 2026-11-06
- **Statut** : réalisé sur la branche `feature/paires-lot-b` (depuis `main` = `59e9e22`, lot A fusionné), non commité à la rédaction. Non validé par un enseignant (démonstration seulement).
- **Source des règles** : cadrage phase 4 §4.1 à §4.4, §5, décisions P1 à P12 ; fiches L6 et M7 du catalogue v0.2 ; règles précisées par Isaac pour le lot B (2026-11-06).

## 6. Fichiers du lot B

| Fichier | Rôle |
|---|---|
| `src/utils/pairsGame.js` | Ajouts au moteur : plateau de cartes (`createMemoryBoard`), état et retournement (`createMemoryState`, `flipCard`, `closeMismatch`, `isFaceUp`), préparations L6 (`createVocabularyMemoryGame`, `memorySubjects`) et M7 (`multiplicationSetup`, `createMultiplicationMemoryGame`, `singleTableOptions`) ; tirage commun factorisé (`drawPairs`, `vocabularySubjects`) |
| `src/utils/pairsMemory.test.js` | Tests unitaires du lot B (10) |
| `src/components/MemoryPlay.jsx` | Partie de mémoire commune à L6 et M7 (plateau, paires trouvées, fin) |
| `src/pages/MemoryGame.jsx` | L6 « Mémoire FR ↔ EN » : choix niveau + matière + sujet (comme L3) |
| `src/pages/TablesMemoryGame.jsx` | M7 « Mémoire des tables » : classe du profil (comme les pyramides), toutes les tables ou une seule |
| `src/styles/MemoryGame.css` | Cartes, étiquette de langue, paires trouvées |
| `src/App.jsx`, `src/pages/StudentDashboard.jsx` | Pages `memoryGame` et `tablesMemoryGame`, deux cartes au tableau de bord |
| `e2e/paires-memoire.spec.js`, `e2e/paires-tables.spec.js` | Tests navigateur (5 + 5 tests × 3 projets) |

L3 n'a pas changé de comportement : `createPairsGame` et `translationSubjects` passent par les fonctions communes, avec le même ordre d'appel du générateur. Vérifié en comparant 6 420 parties L3 (tous niveaux, tous sujets, 30 graines, FR et EN) avec la version de `main` : 0 différence (contrôle ponctuel, non conservé comme test) ; tests unitaires et navigateur de L3 relancés.

## 7. Moteur : mémoire

- **Plateau** : le tirage est celui de L3 (mêmes règles, même graine) ; puis les deux cartes de chaque paire (un « côté » chacune) sont mélangées avec le même générateur.
- **Retournement** (`flipCard`) : 1re carte ouverte ; 2e carte : même paire = trouvée (10 points), sinon les deux restent ouvertes. Un **coup** = une 2e carte retournée. Deux cartes qui ne vont pas ensemble se referment après `MISMATCH_DELAY_MS` (1,2 s), ou dès que l'élève touche une carte (s'il touche l'une des deux, elles se referment seulement ; sinon elles se referment et la carte touchée s'ouvre). Pas de pénalité, pas d'aide.
- **État** : celui de L3 (`resolved`) plus `open` et `moves` : `isFinished`, `pairsScore`, `colorIndex` sont réutilisés.

## 8. Règles de L6

| Règle | Mise en œuvre |
|---|---|
| P3 | 4 / 6 / 6 paires (`MEMORY_SETTINGS`), soit 8 / 12 / 12 cartes |
| P4 | niveau + matière + sujet, sujets grisés (« pas assez de mots ») ; jouables : SIL-CP 23/23, CE1-CE2 29/33, CM1-CM2 38/51 |
| P5 | côtés `fr` et `en` fixes : **même numéro = mêmes cartes aux mêmes places en français et en anglais** ; la carte dans la langue de l'interface au lancement est mise en avant (fond jaune pâle, étiquette pleine « FR » ou « EN ») ; l'autre carte a une étiquette blanche |
| P6 | aucune aide (P6 vise L3 et L4) |
| P7 | 10 points par paire, nombre de coups affiché, pas d'étoiles, pas de badge ; `gameType` = `pairsMemory` |
| P8 | `displayText` (majuscules, accents, espaces) |
| P11 b, P12 a | mêmes candidats que L3 (`translationCandidates`) : aucune forme commune entre deux paires (donc pas deux cartes de même texte d'une paire à l'autre), au plus 1 paire FR = EN (ses deux cartes, ex. TOTAL / TOTAL, se distinguent par l'étiquette) |
| Fiche L6 | chaque paire trouvée reste ouverte sur le plateau (même couleur, même numéro) et s'ajoute à la liste « Paires trouvées », les deux mots côte à côte (langue de l'interface d'abord) |

## 9. Règles de M7

| Règle | Mise en œuvre |
|---|---|
| Classe | `resolveMathClass` (classe et sous-système du profil, sinon première classe de la tranche, signalée), champ `tables` de `reglages-maths.js` (provisoire, D4) |
| P3 | 4 / 6 / 6 paires selon le niveau de la classe résolue |
| P10 a | par défaut toutes les tables de la classe mêlées ; option « une seule table » ; facteurs 1 à 10 ; SIL inclus (tables 1 et 2) ; Class 1-2 : carte visible, message « Pas encore de table de multiplication pour ta classe », bouton « Commencer » inactif |
| P12 a | une clé par produit : jamais deux opérations de même résultat (ni 2 × 6 avec 3 × 4, ni 3 × 4 avec 4 × 3), donc pas deux cartes identiques |
| Cartes | « 3 × 4 » (table × facteur) ↔ « 12 » |
| Enregistrement | `itemId` = le fait (« 3×4 ») ; `gameType` = `pairsMultiplication` |

Contrôlé par les tests unitaires : toutes les classes des deux sous-systèmes, toutes les tables et chaque table seule, 200 graines chacune : partie complète, produits distincts, au plus une opération triviale.

## 10. Enregistrement (L6 et M7)

- `saveUserProgress(userId, id, true, null, { gameType, itemId: id })` par paire trouvée (L6 : id du mot ; M7 : fait).
- `saveScore` **une seule fois, dès la dernière paire** (comme le lot A ; « Retour » ne fait pas perdre le score) :
  - L6 : `saveScore(userId, 'pairsMemory', score, niveau, { seed, language, subject, pairCount, moves })` ;
  - M7 : `saveScore(userId, 'pairsMultiplication', score, niveau, { seed, language, className, subsystem, tables, table, pairCount, moves })` (`table` = null si toutes les tables).
- Aucun nouveau badge.

## 11. Choix provisoires du developer (lot B, à valider par Isaac)

1. **Opérations triviales** : une opération est triviale si un facteur vaut 1 ; **au plus 1 par partie** (`MAX_TRIVIAL_OPERATIONS`), par le mécanisme des candidats restreints de L3. En SIL (tables 1 et 2 mêlées), la table de 1 apparaît donc au plus une fois.
2. **Table de 1 non proposée seule** (toutes ses opérations sont triviales) ; toute autre table seule donne 10 produits distincts, assez pour 6 paires. Aucun autre ajustement n'a été nécessaire.
3. **Délai de fermeture** : 1,2 s ; toucher une carte referme plus tôt.
4. **Étiquette de langue visible seulement face visible** : le dos est le même pour toutes les cartes (l'élève ne sait pas, avant de retourner, si la carte est française ou anglaise). Variante possible : étiquette au dos, plus facile pour les SIL-CP.
5. **Disposition** : 4 colonnes ; sur téléphone (≤ 480 px), 2 colonnes pour 8 cartes et 3 pour 12 ; cartes d'au moins 72 px de haut ; texte plus petit au-delà de 12 caractères.
6. **Animation** : retournement bref (0,25 s, rétrécissement horizontal), supprimé si l'élève a demandé de réduire les animations (`prefers-reduced-motion`).
7. **Tableau de bord** : deux cartes séparées « Mémoire FR ↔ EN » et « Mémoire des tables », après « Associations FR ↔ EN ».
8. **Accessibilité** : chaque carte annonce sa position et son état (« Carte 3, face cachée », « Carte 3 : TOTAL, français, retournée », « trouvée, paire 2 ») ; les retournements sont annoncés par une région `aria-live`.
9. Écran de fin : récapitulatif des paires, nombre de coups, score ; bouton « Terminer » comme L3.
10. **4 `gameType` au lieu des 3 de P7 a** : M7 (`pairsMultiplication`) séparé de L6 (`pairsMemory`) pour ne pas mêler langue et mathématiques ; à trancher par Isaac.
11. **Ligne « Partie n° »** de M7 : affiche la classe résolue (ex. « CP ») et non la tranche, pour éviter « Class 1-2 » pour un élève de CP en anglais. Langue enregistrée = langue de l'interface au lancement (comme L6). Cartes trouvées en `aria-disabled` (le focus clavier reste en place).

## 12. Limites du lot B

- Aucun essai sur un vrai téléphone (Playwright seulement, 375 et 320 px).
- Nombre de paires, lisibilité de 12 cartes, délai de fermeture : à valider par un enseignant (Q7, enseignant non désigné).
- Tables par classe toujours provisoires (Class 1-2, Class 3-4 « bonds », CM2 11 et 12, Class 6) ; facteurs 1 à 10 non confirmés.
- Score uniforme (10 points par paire, cadrage §4.3) : il ne mesure pas la mémoire ; le nombre de coups est seulement affiché et enregistré.
