# Jeux de paires (moteur C) : note de conception des lots A, B et C

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
- **Statut** : réalisé sur la branche `feature/paires-lot-b` (depuis `main` = `59e9e22`, lot A fusionné) ; fusionné dans `main` (pull request n° 22, commit de fusion `1dcb203`). Non validé par un enseignant (démonstration seulement).
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

---

# Lot C : définitions du lot 0 et jeu L4 « Mot ↔ définition »

- **Date** : 2026-11-06
- **Statut** : réalisé sur la branche `feature/paires-lot-c` (depuis `main` = `1dcb203`, lots A et B fusionnés), non commité à la rédaction. Non validé par un enseignant (démonstration seulement).
- **Source des règles** : cadrage phase 4 §4.1, §4.2, §5, §6 et décisions P1 à P12 ; fiche L4 du catalogue v0.2 ; `DIBIE/contenus/definitions-ambigues-lot0-v0.1.md` (dépôt JARVIS), validé par Isaac le 2026-11-06 (14 définitions, règle L0-T, RANGER inchangé).

## 13. Fichiers du lot C

| Fichier | Rôle |
|---|---|
| `src/data/vocabulaire.json` | 14 entrées, 27 champs `def_fr` / `def_en` remplacés (§14) ; rien d'autre |
| `src/utils/pairsGame.js` | Préparation L4 : `definitionCandidate(s)`, `definitionSubjects`, `createDefinitionGame`, critères `definitionMentions` (§6.2) et `definitionRevealsForm` ; réglages `DEFINITION_SETTINGS` ; `GAME_TYPE_DEFINITION` |
| `src/utils/pairsDefinition.test.js` | Tests unitaires du lot C (11) |
| `src/pages/DefinitionGame.jsx` | L4 : choix niveau + matière + sujet (comme L3), partie en colonnes, aides, fin |
| `src/styles/PairsGame.css` | Disposition « mots au-dessus, définitions pleine largeur » (§17) |
| `src/App.jsx`, `src/pages/StudentDashboard.jsx` | Page `definitionGame`, carte « Mot ↔ définition » |
| `e2e/paires-definitions.spec.js` | Tests navigateur (6 tests × 3 projets) |
| `src/utils/anagramGame.reference.test.js`, `src/utils/mysteryGenerators.reference.test.js` | Valeurs de référence recalculées (§16) |

## 14. Définitions du lot 0 appliquées

Remplacement exact des textes du bloc JSON « decision: valide » (id et `mot_fr` vérifiés avant chaque remplacement ; format du fichier conservé). Contrôle par script : 27 champs changés, tous dans la liste ; aucun autre champ, aucune autre entrée. Le bloc JSON et les tableaux du document donnent les mêmes textes (seule différence : la mention « *Facultatif* » et une remarque entre parenthèses dans la colonne de PARALLÉLÉPIPÈDE, qui ne font pas partie de la définition).

| id | Mot | Champs |
|---|---|---|
| vocab_0177 | PAVÉ | def_fr, def_en |
| vocab_0146 | PARALLÉLÉPIPÈDE | def_en seulement |
| vocab_0012 | ADDITIONNER | def_fr, def_en |
| vocab_0019 | AJOUTER | def_fr, def_en |
| vocab_0113 | AXIALE | def_fr, def_en |
| vocab_0123 | CENTRALE | def_fr, def_en |
| vocab_0045 | ENTIER | def_fr, def_en |
| vocab_0016 | CARDINAL | def_fr, def_en |
| vocab_0025 | ÉCART | def_fr, def_en |
| vocab_0469 | MAGASIN (CE1-CE2) | def_fr, def_en |
| vocab_0632 | DOUCHE (CE1-CE2) | def_fr, def_en |
| vocab_0739 | DOUCHE (SIL-CP) | def_fr, def_en |
| vocab_0704 | GROUPE | def_fr, def_en |
| vocab_0476 | TROTTOIR | def_fr, def_en |

RANGER (vocab_0079) : inchangé (option a). Remarque de forme, non tranchée : 7 des nouvelles définitions utilisent l'apostrophe droite (« d'allumettes », « l'eau »…), alors que le fichier utilise presque partout l'apostrophe typographique (621 champs de définition à apostrophe typographique, contre 5 à apostrophe droite avant le lot C) ; textes appliqués tels que validés.

## 15. Règles de L4 et tirage

| Règle | Mise en œuvre |
|---|---|
| P3 b | pas de SIL-CP ; 4 paires en CE1-CE2, 5 en CM1-CM2 (`DEFINITION_SETTINGS`) |
| P4 | niveau + matière + sujet ; sujets grisés (« pas assez de mots ») **selon la langue de l'interface** (les définitions et les règles dépendent de la langue) |
| Langue | mots et définitions dans la langue de l'interface au lancement (`mot_fr` / `def_fr` ou `mot_en` / `def_en`) ; un même numéro peut donc donner des paires différentes en français et en anglais |
| P6 a | sans pénalité ; 2 erreurs sur un élément : indice = traduction du mot dans l'autre langue (première forme, majuscules) ; 3 erreurs : « Voir la réponse », 0 point, `isCorrect: false` |
| P7 a | 10 points par paire, pas d'étoiles, pas de badge ; `gameType` = `pairsDefinition` ; `saveScore` une seule fois dès la dernière paire (comme L3), détails `{ seed, language, subject, pairCount }` |
| P8 | mots en majuscules (`displayText`), définitions en casse normale (texte stocké) |
| P11 | sans objet en L4 (mots identiques FR = EN gardés sans limite) |
| P12 a, L0-T | clés « w: » de toutes les formes FR et EN, comme L3 : deux entrées qui partagent une forme ne sont jamais tirées ensemble (ADDITIONNER / AJOUTER, PAVÉ / PARALLÉLÉPIPÈDE, RANGER / ORDONNER, MAGASIN / BOUTIQUE…) |
| §5 règle 2 | clé « d: » de la définition affichée : jamais deux définitions identiques |
| Fiche L4 (déf. qui donne son mot) | entrée écartée si sa définition contient son propre mot ou un mot qui commence par lui (`definitionRevealsWord`, décision du 2026-11-02), pour **toutes** les formes « A / B » du mot de la langue ; étendu aux mots composés (`definitionRevealsForm`) |
| §6.2 (automatique) | si la définition de A contient le mot affiché de B, A et B reçoivent une clé commune « m: » et ne sont jamais tirés ensemble |

**Critère exact de la règle §6.2 (CHOIX PROVISOIRE)** : mot entier après normalisation (`gridTokens` : majuscules, sans accents, ligatures développées, découpage sur tout ce qui n'est pas une lettre), ou ce mot suivi de S ou X (pluriel simple) ; mot composé cherché en entier et dans l'ordre ; mots de moins de 3 lettres ignorés ; seule la forme affichée (première forme) de B est cherchée. Pas de « commence par » ni de féminin : mesurés, ils ajoutaient surtout des faux positifs (« demi-droites » pris pour DROIT, « cordes » pour COR, « played » pour PLAY ; et, avec toutes les formes, « plants » pour SOW par sa 2e forme « Plant ») sans changer le nombre de sujets jouables. ARE n'est trouvé ni dans « aire » ni dans « hectare ».

**Mesure sur le vocabulaire (2026-11-06, après le lot 0)** :

| Langue, niveau | Jouables | Sans la règle §6.2 | Entrées écartées (déf. donne le mot) | Liens §6.2 (A cite B) |
|---|---|---|---|---|
| FR, CE1-CE2 (4 paires) | 31/33 | 32 | 3 | 96 |
| FR, CM1-CM2 (5 paires) | 32/51 | 40 | 22 | 202 |
| EN, CE1-CE2 | 31/33 | 32 | 19 | 105 |
| EN, CM1-CM2 | 32/51 | 39 | 41 | 211 |

- Sujets perdus à cause de §6.2 : CE1-CE2 Sciences (FR et EN) ; CM1-CM2 FR Angles, Matière / États, Multiplication, Numération, Opérations, Polygones, Proportionnalité, Solides ; CM1-CM2 EN Angles, Droites, Matière / États, Opérations, Polygones, Proportionnalité, Solides. Cause principale : les mots génériques cités par beaucoup de définitions (FACE, ANGLE, LINE, SOLIDE, POLYGONE, MASSE, CÔTÉ…), surtout en géométrie.
- Faux positifs relevés en lisant les liens : peu nombreux (ex. COMMON dans la définition d'INTERSECTION, OTHERS dans SOLIDARITY, CHECK dans VALIDATE) ; la plupart des liens sont de vraies citations d'un mot de la partie. La règle est **restrictive en CM1-CM2** (8 sujets de moins en français, 7 en anglais) plutôt que bruitée.
- Le grisage utilise la borne sûre du moteur (partie complète pour **toute** graine). Sur 300 graines, 3 sujets grisés donneraient pourtant toujours une partie complète (FR CM1-CM2 Polygones, Proportionnalité ; EN CM1-CM2 Solides) : coût de la borne, accepté pour garder la garantie.
- Sujets des définitions corrigées : Commerce, Hygiène, Musique, Ville (CE1-CE2), Symétrie et Nombres (CM1-CM2) jouables en français et en anglais ; Addition (4 paires au plus, ADDITIONNER / AJOUTER partageant « Add »), Comparaison et Solides restent grisés en CM1-CM2.

## 16. Effets du lot C sur les autres jeux

- **L3 et L6** : comparaison de 21 400 parties (tous niveaux, tous sujets, graines 0 à 49, FR et EN) entre le vocabulaire de `main` et celui du lot C : seules changent les parties du sujet **Symétrie (CM1-CM2)** (68 parties), parce qu'AXIALE et CENTRALE n'ont plus la même `def_fr` (clé « dfr: ») : ce sujet passe de 8 à 9 paires garanties (jouable avant comme après). Les indices de L3 (définitions) changent pour les 14 entrées. M7 n'utilise pas le vocabulaire.
- **Anagrammes et anagrammes mystères** : les définitions servent à écarter les mots dont la définition donne la réponse et sont incluses dans les parties. Cinq tests de référence (R1, R2, R3, GR1, GR2) échouaient avec le nouveau vocabulaire et passaient avec celui de `main` (code identique, vérifié). Valeurs recalculées : anagrammes CM1-CM2 en anglais (3 parties de R1), empreintes R2, R3 et GR1, parcours GR2 « CM1-CM2 en n° 0 » (MUSEUM devient VOLUME). **Conséquence** : des numéros déjà donnés ne redonnent plus la même partie (mesure du reviewer sur les numéros 0 à 149 : en CM1-CM2 anglais, presque toutes les parties des anagrammes et des mystères changent de mots, car la nouvelle définition anglaise de CENTRALE ne cite plus CENTRAL, qui entre dans les tirages ; ailleurs seul le texte des définitions change, dans 2 à 8 % des parties ; SIL-CP inchangé). **Accepté par Isaac le 2026-11-07** (« a) Accepter ») : application en démonstration, pas d'exception dans le code.

## 17. Choix provisoires du developer (lot C, à valider par Isaac)

1. **Disposition** : sur téléphone (moins de 700 px), mots en grille de deux colonnes au-dessus, définitions en liste pleine largeur en dessous (texte normal, aligné à gauche) ; sur écran large, mots à gauche (1/3), définitions à droite (2/3). Vérifié à 375 et 320 px (Playwright) avec la partie aux définitions les plus longues : pas de débordement, cibles d'au moins 44 px ; l'élève doit faire défiler entre un mot et une définition éloignée.
2. **SIL-CP** : la carte est visible pour tous ; pour un élève de SIL-CP, la page s'ouvre en CE1-CE2 avec le message « Ce jeu commence au CE1-CE2 : il faut lire des phrases. Tu peux essayer avec un adulte. » ; le niveau SIL-CP n'est pas proposé.
3. **Indice depuis une définition** (2 erreurs sur une définition) : « le mot de cette définition se dit « X » en anglais » (traduction du mot à trouver) ; depuis un mot : « Indice pour « PAVÉ » : en anglais, « CUBOID » ». Pour un mot identique dans les deux langues (TOTAL / Total), l'indice n'aide pas.
4. **Critère §6.2** : mot entier ou pluriel simple, forme affichée seulement (§15).
5. **Formes « A / B » pour la définition qui donne son mot** : toutes les formes (plus strict que la forme affichée).
6. **Message de bonne réponse** court (« Bravo ! PAVÉ ») ; récapitulatif « MOT : définition ».
7. **Références des anagrammes recalculées** (§16) plutôt que laissées en échec.
8. Page séparée (`DefinitionGame.jsx`), copiée de L3 comme L6 l'avait fait : duplication assumée de l'écran de choix (mise en commun possible plus tard).

## 18. Limites du lot C

- Aucun essai sur un vrai téléphone ; lisibilité des définitions longues et nombre de paires à valider par un enseignant (Q7, non désigné).
- La règle §6.2 ne détecte pas une définition qui **convient** à un autre mot sans le citer (cas du §5 du document du lot 0 : SOMME / TOTAL, ÉTAL / ÉTALAGE, AVENUE / BOULEVARD, instruments de Musique…) : ces doubles bonnes réponses restent possibles en L4 (passe complémentaire ou liste manuelle à décider).
- Définitions anglaises non relues par un enseignant pour L4 ; inclusions mathématiques (CUBE / PARALLÉLÉPIPÈDE, ENTIER / CARDINAL) non traitées.
- Le critère §6.2 ignore les mots de moins de 3 lettres et les dérivés autres que le pluriel en S ou X.
