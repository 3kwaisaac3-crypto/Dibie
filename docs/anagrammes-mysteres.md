# Anagrammes mystères : audit et conception (phases A et B)

- **Date** : 2026-11-03
- **Statut** : **architecture validée par Isaac le 2026-11-03** (décisions M1 à M8 : toutes les recommandations du §9). **Lot 1 réalisé** le 2026-11-03 sur la branche `feature/anagrammes-mysteres` (non fusionnée) : voir §11.
- **Demande** : cahier des charges « Extension du module anagrammes : anagrammes classiques et jeux de mystères lexicaux », fourni par Isaac le 2026-11-03.
- **Point de départ** : `main` = `53d4244`.

---

## 1. Audit de l'existant

### 1.1 État de Git

| Dépôt | Branche | État |
|---|---|---|
| Dibiè | `feature/anagrammes-mysteres`, créée depuis `main` (`53d4244`) | Seul ce document est ajouté ; aucun travail en cours ailleurs |
| Derniers commits de `main` | `53d4244` pyramides, `ee09309` anagrammes, `17b50b7` accès par matière | Tout est fusionné |

### 1.2 Ce qui existe et fonctionne

| Élément | Fichier | Constat |
|---|---|---|
| Anagrammes classiques | `src/utils/anagramGame.js`, `src/pages/AnagramGame.jsx` | Jouable, fusionné (pull request n° 15) ; 13 tests unitaires et 7 tests navigateur sur 3 tailles d'écran |
| Mélange sûr | `scrambleWord`, `reshuffleOrder` | Ne redonne jamais une bonne réponse ; mots interdits filtrés (liste vide) |
| Anagrammes acceptées | `buildAnswerIndex`, `letterKey`, `findAnswer` | Comparaison sur la **multiplicité exacte des lettres** (clé triée), déjà conforme au §13 du cahier |
| Aides | `correctPositions`, `firstLettersHint`, `TRIES_BEFORE_SOLUTION` | Lettres bien placées, indice, solution au 3e essai |
| Définitions qui donnent la réponse | `definitionRevealsWord` | Écartées, y compris les formes dérivées (décision du 2026-11-02) |
| Normalisation, langue | `normalizeWord`, `entryText` | Accents, ligatures, forme anglaise avant « / », mots composés exclus |
| Graine reproductible | `createRandom`, `newSeed`, `isValidSeed` | Même numéro = même partie |
| Niveaux | `ANAGRAM_SETTINGS`, `libelleNiveau` | 3 tranches ; longueurs provisoires |
| Thèmes | `src/data/sujets-matieres.js` | 94 sujets, 3 matières + « Autres », traductions anglaises |
| Score et progrès | `saveScore`, `saveUserProgress` (`gameType`, `itemId`, `isCorrect`) | Formats souples, sans nouvelle clé nécessaire |
| Récompenses | `getUserStats` | Points cumulés, série de jours, 4 badges simples |
| Hors ligne | Service worker du build | Tout le contenu est embarqué |

### 1.3 Ce qui n'existe pas

| Élément demandé | Constat |
|---|---|
| Synchronisation | **Aucune** : pas de serveur, données sur l'appareil seulement |
| Statut de validation du vocabulaire | **Aucun champ** : les 1 533 entrées sont en BROUILLON, à valider par un enseignant non encore désigné (Q7) |
| Syllabes | Aucune donnée ; aucune syllabation fiable possible par programme en français ni en anglais |
| Phrases, proverbes, maximes, personnalités | Aucun contenu rédigé dans Dibiè |
| Reprise d'une partie interrompue | Aucun jeu ne la propose aujourd'hui |
| Étoiles, trophées, niveaux de maîtrise | Absents ; seuls existent les 4 badges de `getUserStats` |
| Chronomètre | Absent, désactivé par défaut selon D5 |

### 1.4 Ressources lexicales mesurées

Mots actifs d'au moins 3 lettres, sans mot composé :

| Langue | SIL-CP | CE1-CE2 | CM1-CM2 |
|---|---:|---:|---:|
| Français | 341 | 510 | 618 |
| Anglais | 326 | 491 | 602 |

Entre 22 et 41 sujets par niveau et par langue comptent au moins 6 entrées.

**Ressources réellement utilisables par les jeux**, une fois appliqués les longueurs de chaque niveau et le retrait des définitions qui donnent la réponse (recompté par le reviewer) :

| Langue | SIL-CP | CE1-CE2 | CM1-CM2 |
|---|---:|---:|---:|
| Mots distincts, français | 141 | 312 | 412 |
| Mots distincts, anglais | 186 | 325 | 358 |
| Sujets d'au moins 6 mots utilisables, français | 13 | 23 | 28 |
| Sujets d'au moins 6 mots utilisables, anglais | 17 | 23 | 27 |

Certaines lettres sont introuvables, ce qui limite les mots mystères possibles (décompte du reviewer, en français) :
- **SIL-CP**, où l'extraction se fait par la dernière lettre ou une lettre désignée (§6.1, règle 8) : aucun mot ne finit par A, B, G, H, J, K, M, V, W ou Y.
- **CE1-CE2 et CM1-CM2** : aucun mot ne commence par X, Y ou Z, ni par U en CM1-CM2.

MYSTÈRE, absent du vocabulaire, n'est de toute façon pas une solution admise (§6.2, règle 2). Le générateur choisira des solutions dont toutes les lettres peuvent être obtenues.

### 1.5 Contrôle des exemples du cahier

| Exemple | Résultat |
|---|---|
| Mot mystère MYSTÈRE (AISONM → MAISON, etc.) | **Exact** : les 7 mélanges ont les mêmes lettres que leur réponse, et les premières lettres donnent M-Y-S-T-E-R-E. Mais MYSTÈRE et YAOURT ne sont pas dans le vocabulaire Dibiè ; en français, seul YEUX (SIL-CP) commence par Y (voir §1.4) |
| Syllabes CA – MER – OUN → CAMEROUN | **À corriger** : le découpage syllabique usuel est CA-ME-ROUN (jugement linguistique de JARVIS et du reviewer, sans source consultée). Le contenu des syllabes doit donc être rédigé et vérifié, pas déduit |
| Phrase « L'école est le chemin du savoir » | **À adapter** : pour L'ÉCOLE, on peut donner « L' » et faire trouver ÉCOLE. LE et DU ont 2 lettres, sous le minimum de 3 (D9) : ils ne peuvent pas être des anagrammes. EST a 3 lettres et pourrait l'être ; le donner d'office est un choix pédagogique (M7). CHEMIN et SAVOIR sont absents du vocabulaire : une phrase préconçue porte donc ses propres réponses (§6.2) |

### 1.6 Diagnostic

1. **Existe** : le jeu classique complet, les normalisations, les thèmes, le score.
2. **Fonctionne** : tout ce qui précède, testé.
3. **Réutilisable** : mélange, index des réponses, aides, graine, langue, thèmes, score, progrès, pavé de jeu.
4. **À améliorer** : extraire de `createAnagramGame` la fabrication d'**un** mot, pour que le moteur des parcours la réutilise sans la recopier.
5. **À créer** : moteur des parcours, règles de validation, contenus rédigés (syllabes, phrases, énigmes), écrans du module, étoiles.
6. **Risques de régression** : la refonte de `createAnagramGame` (graines des parties existantes) et l'écran d'entrée du jeu actuel.

---

## 2. Organisation proposée du module

```text
Carte « Anagrammes » du tableau de bord
└── Accueil du module
    ├── Famille A : Anagrammes classiques (jeu actuel, inchangé)
    └── Famille B : Anagrammes mystères
        ├── Jeu 1 : Mot mystère
        ├── Jeu 2 : Casse-tête des syllabes
        ├── Jeu 3 : Phrase secrète
        ├── Jeu 4 : Mystère des thèmes
        ├── Jeu 5 : Message codé
        └── Jeu 6 : Grande énigme
```

Un **parcours** est une suite d'étapes. Chaque étape est une anagramme classique (même mélange, mêmes aides) qui, une fois résolue, donne un **élément secret**. Une **résolution finale** propre à chaque jeu assemble ces éléments.

---

## 3. Les six jeux : faisabilité

| Jeu | Élément gagné | Résolution finale | Contenu | Génération automatique |
|---|---|---|---|---|
| 1. Mot mystère | Une lettre (1re, dernière, position, ou lettre désignée) | Remettre les lettres dans l'ordre et écrire le mot | Vocabulaire existant | **Oui** : choisir le mot mystère, puis un mot par lettre portant cette lettre à la position prévue |
| 4. Mystère des thèmes | Le mot lui-même | Choisir le thème parmi 4 propositions, avec indices progressifs | Vocabulaire et sujets existants | **Oui, sous conditions** : la fiche L9 du catalogue rappelle que le champ `sujet` « ne suffit pas pour une génération automatique sûre ». Les sujets se recouvrent, et un même mot peut figurer dans deux sujets (SOL : Environnement et Musique ; DOCTOR : Métiers et Santé). Un programme ne peut donc pas prouver qu'un mot n'appartient pas à une proposition fausse. Proposition : une liste fixe de couples « thème, propositions fausses », relue une fois par l'educator puis par vous |
| 5. Message codé | Une correspondance (lettre ↔ nombre ou symbole) | Décoder un mot ou une courte phrase avec la clé gagnée | Mots : vocabulaire ; phrases : rédigées | **Oui pour un mot** ; phrases rédigées. Reprend la fiche L11 du catalogue (« mots codés », prévue à l'étape 9), dont la clé partielle en CM1-CM2 |
| 2. Casse-tête des syllabes | Une syllabe | Remettre les syllabes dans l'ordre | **Découpage syllabique rédigé et vérifié** | Non : à mon avis, aucune syllabation par programme n'est assez fiable pour des élèves (appréciation de JARVIS) |
| 3. Phrase secrète | Un mot (petits mots donnés) | Remettre les mots dans l'ordre (moteur de L13) | **Phrases rédigées et vérifiées**, toutes les réponses valides prévues | Non. Reprend la fiche L13 (« phrase à reconstruire », étape 9) : la majuscule du premier mot donne un indice, à assumer ou à neutraliser selon le niveau. Distinct de L12 (« phrases mystère » dans une grille de mots mêlés) |
| 6. Grande énigme | Lettre, syllabe, mot ou indice | Écrire la solution (mot, proverbe, personnalité, patrimoine) | **Contenu rédigé, faits vérifiés** par le researcher | Non |

---

## 4. Architecture technique

Même pile, aucune dépendance, tout hors ligne.

| Rôle | Fichier proposé | Nature |
|---|---|---|
| Fabrication d'une anagramme | `src/utils/anagramGame.js` : nouvelle fonction exportée `createAnagramItem`, utilisée par `createAnagramGame` | **Modification à risque.** `createAnagramItem` reçoit le même générateur aléatoire et consomme les tirages dans le même ordre, y compris pour les mots écartés. **Avant** la refonte, des parties de référence sont figées dans un test (par exemple CE1-CE2, numéro 12345, français : PORTE → EOPTR, SINGE → ENIGS, ROBOT → BOTRO, HARICOT → ATOHRIC, CÉRÉALE → RELCAEE) |
| Moteur des parcours | `src/utils/mysteryEngine.js` | Nouveau, pur : étapes, extraction, assemblage, vérification d'une réponse finale |
| Générateurs | `src/utils/mysteryGenerators.js` | Nouveau : jeux 1, 4 et 5 à partir du vocabulaire |
| Validation | `src/utils/mysteryValidation.js` | Nouveau : contrôles du §6, appliqués à **tout** parcours avant affichage |
| Parcours préconçus | `src/data/parcours-mysteres.js` | Nouveau : jeux 2, 3 et 6, rédigés par l'educator, statut BROUILLON tant qu'ils ne sont pas validés |
| Écrans | `src/pages/AnagramGame.jsx` (accueil des deux familles) et `src/pages/MysteryGame.jsx` | Écran d'entrée modifié, nouvelle page |
| Score et étoiles | `src/db/index.js` (`getUserStats`, badges par famille) | Modification minimale |
| Tests | `src/utils/mystery*.test.js`, `e2e/anagrammes-mysteres.spec.js` | Nouveaux ; `e2e/anagrammes.spec.js` adapté au nouvel écran d'accueil |
| Documentation | `README.md`, `PROJECT_STATUS.md`, `docs/data-dictionary.md` et ce document (spécifications, règles de validation, plan de tests, rapport de recette) | Mise à jour à chaque lot, sans document en double |

---

## 5. Modèle de données

Mêmes conventions que `createAnagramGame` (noms anglais en camelCase dans les objets de jeu).

```js
{
  id: 'mot-mystere-fr-ce1-0001',       // ou graine pour un parcours généré
  game: 'mysteryWord',                 // mysteryWord | syllables | secretSentence | theme | codedMessage | grandRiddle
  language: 'fr',
  level: 'CE1-CE2',
  theme: 'Animaux',                    // sujet du vocabulaire, facultatif
  difficulty: 1,                       // 1, 2 ou 3, comme le champ difficulte du vocabulaire
  extraction: { rule: 'first' },       // first | last | position (n) | marked ; une seule règle par parcours
  steps: [{ id, word, display, definition, answers, firstLetter, tiles, secret }],
  final: { kind: 'word', prompt, solution, acceptedAnswers: [], hints: [] },
  status: 'generated'                  // generated | draft | validated
}
```

- `id` d'une étape : celui de l'entrée du vocabulaire, comme dans `createAnagramGame` ; pour une étape préconçue, un identifiant propre au parcours.
- `status` : `generated` (contrôles automatiques réussis), `draft` (rédigé, non validé), `validated` (validé par un enseignant).
- **Score** : `saveScore(id, 'anagramMystery', score, niveau, { game, language, seed, stars, hintsUsed })`.
- **Progrès** : `saveUserProgress` avec `gameType: 'anagramMystery'` et `itemId` = étape ou finale ; `wordId` = `id` de l'entrée pour une étape, `null` pour la résolution finale.
- **Reprise** : clé `dibieMysteryInProgress`, avec un enregistrement par `userId`. Elle contient le parcours complet (et non le seul numéro, qu'un import local de vocabulaire changerait), l'état de la partie et une version de format. Rien n'est écrit si la donnée est illisible, comme pour les profils. Elle est effacée à la fin de la partie.

---

## 6. Règles de validation (tests automatiques)

Un parcours qui échoue n'est **jamais** montré.

### 6.1 Règles communes

1. Chaque anagramme : mêmes lettres avec la même multiplicité que chaque réponse acceptée, mélange différent de toute bonne réponse, 3 lettres minimum.
2. **Toutes les réponses acceptées d'une étape donnent le même élément secret.** D9 impose d'accepter toutes les anagrammes du vocabulaire : un mot dont les anagrammes donneraient des secrets différents est donc écarté de l'étape, et l'autre anagramme n'est jamais refusée. Exemples avec la première lettre : SON/NOS, CAMION/MANIOC, PIÈCES/ÉPICES, TEAM/MEAT, OKRA/KORA, LAMP/PALM. Le coût est de 2 à 4 mots par niveau.
3. Jamais deux mots aux mêmes lettres dans un même parcours, comme dans `createAnagramGame` ; le mot mystère non plus ne peut pas avoir les mêmes lettres qu'un mot d'étape.
4. Les éléments collectés suffisent à reconstituer la solution finale, dans l'ordre défini.
5. La solution finale est unique, ou ses variantes sont listées dans `acceptedAnswers`.
6. Ni une définition d'étape, ni un indice ne contient la solution finale ou le thème, ni une forme dérivée (`definitionRevealsWord` étendue à la solution et au thème).
7. Mots interdits : contrôle sur les mélanges, la solution et le message.
8. **SIL-CP** : la première lettre y est déjà placée. Avec la règle « première lettre », le secret serait donné d'emblée et les anagrammes filtrées. En SIL-CP, la règle d'extraction est donc la dernière lettre ou une lettre désignée.

### 6.2 Parcours générés (jeux 1, 4 et 5)

1. Chaque mot d'étape est présent et actif dans le vocabulaire, au bon niveau et dans la bonne langue, avec une définition qui ne donne pas la réponse. Le seul dictionnaire est le vocabulaire Dibiè (limite de D9).
2. Jeu 1 : la solution est un mot du vocabulaire du niveau, différente de chacune des réponses, et dont toutes les lettres peuvent être obtenues.
3. Jeu 4 : le thème et ses 3 propositions fausses viennent d'une liste fixe relue (§3). Le nom du thème n'apparaît dans aucun mot d'étape.
4. Jeu 5 : une seule lecture possible du message.

### 6.3 Parcours préconçus (jeux 2, 3 et 6)

1. Une étape préconçue porte sa propre définition, ses réponses acceptées et sa langue. Ses mots peuvent être absents du vocabulaire (CHEMIN, SAVOIR), et une syllabe n'est pas un mot.
2. Les mêmes règles communes (§6.1) s'appliquent.
3. Le parcours reste en statut `draft` jusqu'à votre validation, puis celle d'un enseignant.

---

## 7. Parcours de l'élève et récompenses

- **Écrans** : accueil des deux familles, choix du jeu, niveau et thème (la langue suit l'interface, comme les autres jeux), mission, anagrammes avec la barre des éléments déjà gagnés, résolution finale, victoire.
- **Étoiles** (proposition) : 3 étoiles sans indice, 2 avec un indice ou la première lettre, 1 si une solution a été montrée.
- **Points** : 10 par anagramme et 10 pour le mystère final, comme toute réponse (D10). Un bonus plus élevé pour le mystère serait un écart à D10, posé en M8.
- **Chronomètre** : désactivé par défaut (D5) ; l'option « défi » n'est pas prévue dans ce module.
- **Bilinguisme** : la langue suit l'interface, et chaque langue a ses propres mots, solutions et contenus. Le mode « définition en français, mot en anglais » de la fiche L1 n'est pas prévu ici.
- **Badges** par famille dans `getUserStats` ; trophées et niveaux de maîtrise reportés.

---

## 8. Ordre de réalisation proposé

| Lot | Contenu | Prérequis |
|---|---|---|
| 1 | Accueil des deux familles ; moteur ; validation ; jeu 1 généré ; jeu 4 avec sa liste de thèmes relue ; reprise ; étoiles ; documentation | Décisions M1, M2, M4, M5 et M6 ; liste des thèmes du jeu 4 relue par l'educator et par vous. Si M6 est refusée, le §3 et la règle 3 du §6.2 sont à revoir |
| 2 | Jeu 5 (mots codés générés) | Lot 1 |
| 3 | Jeux 2, 3 et 6 en parcours préconçus | Contenus rédigés par l'educator, faits vérifiés par le researcher, validation par Isaac |
| 4 | Validation par un enseignant ; statut `validated` ; trophées | Enseignant désigné (Q7) |

---

## 9. Décisions à prendre par Isaac

| N° | Question | Recommandation de JARVIS |
|---|---|---|
| M1 | Faire passer ce module avant la phase 4 (associations, mémoire, tables) ? Il avance aussi les fiches L11 (mots codés) et L13 (phrase à reconstruire), prévues à l'étape 9 du catalogue | Oui, en commençant par le lot 1 |
| M2 | Le vocabulaire n'a pas de statut « validé » : les parcours générés peuvent-ils être joués, marqués « démonstration » ? | Oui, comme les autres jeux, avec le statut `generated` affiché à l'adulte |
| M3 | Qui rédige les syllabes, phrases et énigmes des jeux 2, 3 et 6 ? | L'educator propose, le researcher vérifie les faits, vous validez, puis un enseignant |
| M4 | Reprise d'une partie interrompue : la faire pour ce module seulement ? | Oui, car les parcours sont plus longs |
| M5 | Étoiles selon les aides utilisées, sans chronomètre ? | Oui |
| M6 | Jeu 4 : réponse par choix parmi 4 thèmes, plutôt qu'en texte libre ? | Oui, pour éviter les synonymes refusés |
| M7 | Petits mots d'une phrase secrète donnés d'office ? Ceux de moins de 3 lettres (le, du) ne peuvent pas être des anagrammes (D9) ; la question porte sur ceux de 3 lettres, comme « est » | Oui, pour garder les anagrammes sur les mots porteurs de sens |
| M8 | Un bonus plus élevé pour la découverte du mystère final, au-delà des 10 points de D10 ? | Non : 10 points, comme toute réponse, et l'étoile récompense la réussite |

---

## 10. Limites

- Les contenus rédigés des jeux 2, 3 et 6 ne seront pas inventés : tant qu'ils ne sont pas rédigés et vérifiés, ces jeux restent indisponibles.
- La liste de mots interdits est vide : démonstration seulement.
- Les jeux reposent sur un vocabulaire en BROUILLON, jusqu'à sa validation par un enseignant.

---

## 11. Lot 1 réalisé (2026-11-03)

Décisions appliquées : M1 à M8, toutes selon la recommandation du §9. Liste des thèmes du jeu 4 : `themes-mysteres-v0.1.md` de l'educator (dépôt JARVIS), **validée par Isaac le 2026-11-03, à valider par un enseignant** (statut `isaac-validated` de chaque thème).

### 11.1 Fichiers

| Rôle | Fichier |
|---|---|
| Fabrication d'une anagramme | `src/utils/anagramGame.js` : `createAnagramItem` et `listAnagramCandidates` extraites ; parties figées **avant** la refonte dans `src/utils/anagramGame.reference.test.js` (18 parties nommées, dont CE1-CE2 n° 12345 ; empreinte de 1 800 parties, et de 600 avec une liste de mots interdits de test) |
| Moteur | `src/utils/mysteryEngine.js` (pur) : extraction, assemblage, réponse finale, état de la partie, étoiles, points, contrôle de l'état repris |
| Validation | `src/utils/mysteryValidation.js` : règles du §6.1 (sans vocabulaire, aussi à la reprise) et du §6.2 (avec vocabulaire) |
| Générateurs | `src/utils/mysteryGenerators.js` : jeu 1 et jeu 4 ; tout parcours est validé avant d'être renvoyé, sinon `null` |
| Thèmes | `src/data/themes-mysteres.js` : 22 thèmes (8, 7, 7) ; le jeu 4 ne lit que ce fichier |
| Écrans | `src/pages/AnagramGame.jsx` (accueil des deux familles ; jeu classique inchangé), `src/pages/MysteryGame.jsx`, `src/components/AnagramBoard.jsx` (plateau extrait du jeu classique, partagé), `src/styles/MysteryGame.css` |
| Stockage | `src/db/index.js` : `getMysteryInProgress`, `saveMysteryInProgress`, `clearMysteryInProgress` ; badges 🔤 et 🕵️ par famille dans `getUserStats` |
| Tests | `src/utils/mystery*.test.js`, `src/db/index.test.js`, `e2e/anagrammes-mysteres.spec.js` ; `e2e/anagrammes.spec.js` adapté à l'accueil |

### 11.2 Choix provisoires (à valider par un enseignant)

- **Jeu 1** : mot mystère de 3 à 5 lettres (SIL-CP), 4 à 6 (CE1-CE2), 5 à 7 (CM1-CM2), une étape par lettre ; mots d'étape aux longueurs des anagrammes classiques ; règle tirée au hasard parmi celles du niveau (SIL-CP : dernière lettre ou case marquée ; ensuite aussi première lettre et 2e ou 3e lettre) ; la case de la lettre secrète est marquée ★ quelle que soit la règle. Les étapes sont présentées dans un ordre mélangé : les lettres gagnées ne donnent jamais le mot dans l'ordre, et la finale est elle-même une anagramme (mêmes aides). Indice de la finale : la définition du mot mystère.
- **Jeu 4** : 5 anagrammes ; l'élève choisit une « série » sans voir le nom du thème ; 2 indices au plus, qui éliminent chacun une proposition fausse ; une proposition fausse choisie est rayée ; s'il ne reste qu'une proposition, elle est donnée comme solution (1 étoile).
- **Étoiles** : 3 sans aide ; 2 si un indice a servi (indice « première lettre » d'une étape ou de la finale au 2e essai faux, indice de la finale), ou après 2 propositions fausses au jeu 4 ; 1 si une solution a été montrée. Une solution montrée donne quand même l'élément secret, sans points.
- **Règle 6 étendue au thème** : un mot d'étape est écarté si sa définition ou le mot contient le nom du thème ou une forme dérivée (radical de 4 à 5 lettres : AGRICULTURE → AGRIC, « agricole »), ou si le mot est contenu dans le libellé (PORT dans « transports », règle R2). Règle prudente : elle écarte aussi des mots sans rapport qui commencent de la même façon.
- **R1** appliquée plus strictement que proposé : tout mot qui a une autre anagramme dans le vocabulaire est écarté du jeu 4 (l'élément gagné est le mot lui-même ; deux réponses donneraient deux éléments, §6.1 règle 2).

### 11.3 Comptes réels des thèmes (par programme, 2026-11-03)

Mots utilisables par langue après toutes les règles (longueurs du niveau, définition, R1, R2, règle 6 étendue, mots écartés), comparés aux comptes faits à la main par l'educator. Un parcours demande 5 mots : en dessous, le thème est **retiré automatiquement**.

| Niveau | Thème | Educator FR / EN | Réel FR / EN | État |
|---|---|---:|---:|---|
| SIL-CP | Les animaux | 10 / 14 | 2 / 2 | **Retiré** |
| SIL-CP | Le corps humain | 12 / 14 | 6 / 8 | Jouable |
| SIL-CP | Les couleurs | 9 / 8 | 0 / 0 | **Retiré** |
| SIL-CP | Les vêtements | 8 / 13 | 5 / 6 | Jouable (FR à la limite) |
| SIL-CP | L'école | 8 / 9 | 10 / 12 | Jouable |
| SIL-CP | Les jeux et les jouets | 10 / 12 | 7 / 20 | Jouable |
| SIL-CP | Les fruits et légumes | 7 / 11 | 2 / 1 | **Retiré** |
| SIL-CP | La cuisine | 8 / 14 | 9 / 18 | Jouable |
| CE1-CE2 | Les animaux | 10 / 10 | 4 / 4 | **Retiré** |
| CE1-CE2 | Les transports | 17 / 15 | 13 / 12 | Jouable |
| CE1-CE2 | Les métiers | 9 / 16 | 8 / 15 | Jouable |
| CE1-CE2 | La musique | 19 / 18 | 23 / 20 | Jouable |
| CE1-CE2 | L'ordinateur | 12 / 16 | 21 / 21 | Jouable |
| CE1-CE2 | Les aliments | 15 / 14 | 16 / 14 | Jouable |
| CE1-CE2 | La santé et l'hygiène | 14 / 19 | 15 / 22 | Jouable |
| CM1-CM2 | Le sport | 17 / 18 | 5 / 7 | Jouable (FR à la limite) |
| CM1-CM2 | Les artisans | 10 / 9 | 6 / 6 | Jouable |
| CM1-CM2 | L'informatique | 26 / 25 | 25 / 14 | Jouable |
| CM1-CM2 | Les formes géométriques | 18 / 16 | 17 / 15 | Jouable |
| CM1-CM2 | L'agriculture | 11 / 10 | 11 / 9 | Jouable |
| CM1-CM2 | La géographie | 12 / 10 | 15 / 13 | Jouable |
| CM1-CM2 | La digestion | 6 / 6 | 8 / 7 | Jouable |

**Cause principale des écarts** : les définitions du vocabulaire nomment souvent la catégorie (« Animal qui donne du lait », « Couleur du ciel », « Fruit rond… », « Sport où l'on marque des buts… »). La règle 6 du §6.1 interdit qu'une définition donne le thème : ces mots sont écartés. Les comptes plus élevés que ceux de l'educator viennent des sujets regroupés et des mots qu'il n'avait pas comptés. Décision possible pour Isaac : garder ces thèmes retirés hors du jeu, ou faire rédiger des définitions qui ne nomment pas la catégorie (sans modifier `vocabulaire.json` dans ce lot).

**Affectation des mots écartés** : la liste de l'educator est globale ; chaque mot est rattaché aux thèmes dont il relève dans le vocabulaire (niveau, langue, sujet). Exceptions suivant le motif donné : JEU et GAME seulement pour les jeux et jouets (pas pour « L'ordinateur », où JEU figure sous Logiciels) ; PAIN seulement en anglais (douleur) ; DOCTEUR, DOCTOR, ONGLE, SANG seulement pour la santé (DOCTOR reste aux métiers). Mots de la liste sans thème concerné : ÉCOLE en CE1-CE2 (Éducation), FEU en CE1-CE2 (Sécurité routière), WASH en SIL-CP (Lessive), SQUARE en CE1-CE2 (Ville).

### 11.4 Relecture du 2026-11-04

Reviewer : PRÊT AVEC RÉSERVES (passage unique). Trois réserves corrigées le 2026-11-04 :

- **Jeu 4, indice** : un indice élimine toujours une proposition fausse pas encore rayée (`nextHintOption` dans `mysteryEngine.js`) ; auparavant, il pouvait rayer de nouveau une proposition déjà choisie par l'élève et coûter une étoile pour rien. Test ajouté (E7).
- **Reprise** : une partie enregistrée lisible mais mal formée est ignorée (`restore` protégé dans `MysteryGame.jsx`) ; auparavant l'écran plantait à chaque ouverture. Test navigateur ajouté, qui échoue sans la correction.
- **Jeu 4, progrès** : quand la dernière proposition est donnée par un indice, la résolution finale est enregistrée (`isCorrect: false`), comme l'annonce `docs/data-dictionary.md`.

Vérifié après correction : `npm test` 184 réussis, 2 ignorés, 0 échec ; lint et build OK ; Playwright anagrammes et anagrammes mystères 51/51.

### 11.5 Reste à faire

- Lot 2 (jeu 5), lot 3 (jeux 2, 3, 6, contenus à rédiger et vérifier), lot 4 (validation par un enseignant, statut `validated`, trophées).
- Validation par un enseignant : liste des thèmes, réglages du §11.2, libellés (« The kitchen », « Craftspeople », « Farming »), lecture des libellés en SIL-CP.
- Décision d'Isaac sur les 4 thèmes retirés (§11.3).
