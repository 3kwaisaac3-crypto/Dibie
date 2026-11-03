# Dibiè-app : dictionnaire des données

- **Date** : 2026-11-01
- **Version auditée** : `main` = `0d49730`
- **Statut** : la partie 1 décrit l'existant, constaté. La partie 2 est une proposition, à valider par Isaac.

---

## Partie 1 : formats existants

### 1.1 Vocabulaire : `src/data/vocabulaire.json`

Tableau de 1 532 objets. Tous les champs sont présents dans toutes les entrées.

| Champ | Type | Exemple | Règle ou constat |
|---|---|---|---|
| `id` | texte | `vocab_0001` | Unique (1 532 valeurs distinctes) |
| `mot_fr` | texte | `AXE` | Aucune entrée avec « / » |
| `mot_en` | texte | `Axis / Number line` | 203 entrées avec « / » ; le jeu prend la première forme (décision du 2026-10-09) |
| `def_fr` | texte | | Définition en français |
| `def_en` | texte | | Définition en anglais |
| `niveau_fr` | texte | `CM1-CM2` | `SIL-CP` (361), `CE1-CE2` (541), `CM1-CM2` (630) |
| `niveau_en` | texte | `Class 5-6` | `Class 1-2`, `Class 3-4`, `Class 5-6` ; correspondance sans exception. Non affiché dans l'interface |
| `sujet` | texte | `Repérage` | 94 valeurs, en français seulement |
| `difficulte` | nombre | `2` | 1 (45), 2 (1 472), 3 (15). **Lu par aucun jeu** |
| `actif` | booléen | `true` | 2 entrées à `false` : `vocab_0143` DELTA, `vocab_0283` FI |

**Champs absents** : matière, image, audio, article, genre, nature grammaticale, famille de mots.

### 1.2 Import CSV : `src/pages/AdminDashboard.jsx`

- Colonnes : `mot_fr;mot_en;def_fr;def_en;niveau;sujet`. La virgule est aussi traitée comme séparateur (`AdminDashboard.jsx:145`) : une définition non entourée de guillemets et contenant une virgule décale donc les colonnes.
- Ligne d'en-tête ignorée seulement si la première cellule vaut `mot_fr`.
- Valeurs ajoutées : `id` = `import_<date>_<n>`, `difficulte` = 2, `actif` = `true`.
- Niveau par défaut : `CM1-CM2`. Sujet par défaut : `Importé`.
- **Défaut confirmé** : les mots importés sont perdus au démarrage suivant.

### 1.3 `localStorage`

| Clé | Contenu | Écrite par | Limite |
|---|---|---|---|
| `dibieVocab` | Copie complète du vocabulaire (430 266 caractères mesurés) | `loadVocabulaire`, `AdminDashboard` | Réécrite à chaque démarrage |
| `dibieScores` | Tableau de scores | `saveScore` | **Aucune** |
| `dibieProgress` | Tableau de réussites par mot | `saveUserProgress` | **Aucune** |
| `dibieWordSearchGrids` | 50 dernières grilles de mots mêlés | `saveWordSearchGrid` | 50 |

**`dibieScores`**

| Champ | Type | Présence |
|---|---|---|
| `userId` | texte | Toujours ; aléatoire à chaque connexion |
| `gameType` | texte | `crossword`, `wordsearch` ou `anagram` |
| `score` | nombre | Toujours |
| `niveau` | texte | Toujours |
| `date` | date ISO | Toujours |
| `subject`, `puzzleType`, `seed`, `requestedSeed` | divers | Mots croisés seulement |
| `seed`, `language` | nombre, texte | Anagrammes seulement : numéro de la partie et langue des mots (`fr` ou `en`) |

**`dibieProgress`**

| Champ | Type | Constat |
|---|---|---|
| `userId` | texte | Comme ci-dessus |
| `wordId` | texte | `id` du vocabulaire dans les trois jeux (`crosswordLayout.js:278`, `WordSearchGame.jsx:156`, `AnagramGame.jsx` : `id` du mot écrit, celui du mot proposé si c'est le même mot normalisé). Limites : un mot effacé garde sa ligne et un mot retapé en crée une seconde (`CrosswordGame.jsx:169`) ; la langue du mot écrit en bilingue n'est pas notée ; la ligne est écrite même si la partie n'est jamais terminée |
| `isCorrect` | booléen | `true` ; `false` seulement aux anagrammes, quand la solution est montrée |
| `gameType`, `itemId` | texte | Facultatifs. Anagrammes : `gameType: 'anagram'`, `itemId` = `id` du mot proposé, `wordId` = `id` du mot écrit (une autre anagramme peut avoir été acceptée) |
| `timeTaken` | nombre ou `null` | 30 fixe (mots croisés), `null` (mots mêlés et anagrammes) : **ne mesure rien** |
| `date` | date ISO | |

**`dibieWordSearchGrids`** : `userId`, `level`, `requestedSeed`, `seed`, `size`, `directions`, `wordIds`, `words`, `generatorVersion`, `blockedWordsVersion`, `date`.

### 1.4 État en mémoire : `src/stores/appStore.js`

| Champ | Valeurs | Constat |
|---|---|---|
| `user` | `{ id, name, email, role }` | `level` jamais renseigné ; perdu au rechargement |
| `isAuthenticated` | booléen | |
| `role` | `student`, `teacher`, `parent`, `admin` | Choix libre |
| `language` | `fr`, `en` | Perdu au rechargement |
| `currentPage` | nom de page | Sans URL |
| `isOnline` | booléen | Suit les événements du navigateur |
| `gameState`, `setGameState`, `setOnline` | | **Non utilisés** par les pages (les pages ont leur propre `gameState` local) |

### 1.5 Objets de jeu (non stockés)

**Mots croisés**, `createCrosswordGame` : `{ requestedSeed, seed, attempts, wordsData, grid, placements }`, ou `null`.

**Mots mêlés**, `createWordSearchGame` : `{ level, seed, wordIds, result }`. L'objet `result` contient notamment `status`, `grid`, `size`, `directions`, `seed`, `requestedSeed`, `placements`, `words`, `rejected`, `message`, `generatorVersion`, `blockedWordsVersion`. Chaque placement contient `word`, `original`, `affichage`, `row`, `col`, `direction`.

**Réglages des mots mêlés** (`WORD_SEARCH_SETTINGS`) : `SIL-CP` 8×8, 5 mots ; `CE1-CE2` 10×10, 7 mots ; `CM1-CM2` 12×12, 9 mots.

**Anagrammes**, `createAnagramGame` : `{ level, language, seed, items }`. Chaque élément de `items` contient `id`, `word` (normalisé), `display` (orthographe exacte), `definition`, `answers` (bonnes réponses `{ id, word, display }`), `firstLetter` (lettre déjà placée ou `null`) et `tiles` (lettres mélangées). Aucune clé de stockage nouvelle : la partie se reproduit par son numéro.

**Réglages des anagrammes** (`ANAGRAM_SETTINGS`, provisoires, à valider par un enseignant) : `SIL-CP` 3 à 5 lettres, première lettre placée ; `CE1-CE2` 4 à 7 ; `CM1-CM2` 6 à 10 ; 5 mots par partie.

---

## Partie 2 : ajouts proposés (seulement pour un besoin identifié)

Aucun ajout ne modifie `vocabulaire.json`. **En place depuis la phase 0 (pull request n° 10, fusionnée le 2026-11-02)** : `dibieProfiles` (2.1), les champs facultatifs `gameType` et `itemId` de `dibieProgress` (2.3) et les clés `dibieLocalVocab` et `dibieSession` (2.4). L'enregistrement de `isCorrect: false` (2.3) est en place pour les anagrammes seulement (2026-11-02) ; les mots croisés et les mots mêlés ne l'écrivent pas.

### 2.1 `dibieProfiles` (besoin : défaut n° 1)

| Champ | Type | Exemple | Note |
|---|---|---|---|
| `id` | texte | `prof_x7f2k` | Fixé à la création |
| `name` | texte | `Étoile` | Pseudonyme tant que l'application reste un prototype ; aucune donnée réelle d'élève |
| `level` | texte | `CE1-CE2` | Valeurs de `niveau_fr` |
| `class` | texte ou `null` | `CE1` | Nécessaire aux bornes de calcul |
| `subsystem` | texte | `fr` ou `en` | Décision D3 |
| `createdAt` | date ISO | | |

### 2.2 Table sujet → matière (besoin : accès par matière)

**En place sur la branche `feature/acces-par-matiere`, non fusionnée (2026-11-02).** Fichier de code `src/data/sujets-matieres.js` : table sujet → matière (`maths`, `sciences`, `tic`) reprenant l'annexe A de `audit-architecture.md`, et table sujet → traduction anglaise des 94 sujets. Aucune donnée stockée, `vocabulaire.json` inchangé ; un score garde le nom français du sujet.

- Un sujet absent de la table (41 sujets du vocabulaire, sujets importés) reste accessible sous « Autres », et un sujet sans traduction garde son nom français.
- Le classement est **validé par Isaac (2026-11-02), à valider ensuite par un enseignant**. Les traductions sont une **proposition, à valider**.

### 2.3 Enrichissements compatibles de `dibieScores` et `dibieProgress`

- `saveScore` prend `gameType` en paramètre et accepte déjà des détails libres : un jeu de calcul peut donc appeler `saveScore(id, 'pyramid', score, niveau, { operation, seed })` **sans aucun changement de format**.
- `dibieProgress` : ajouter `gameType` et `itemId` à côté de `wordId`, et enregistrer aussi `isCorrect: false`. Les anciennes lignes restent lisibles, car les nouveaux champs sont facultatifs.

### 2.4 Migration des données déjà stockées

| Donnée | Traitement proposé | Réversibilité |
|---|---|---|
| Scores des anciens identifiants aléatoires | **Conservés sans rattachement** : rien ne permet de les relier à une personne. Le tableau enseignant les affiche sous « Ancien profil » | Rien n'est effacé |
| Clé `dibieLocalVocab` (ajouts importés) | Nouvelle clé séparée, fusionnée en mémoire au démarrage | Supprimer la clé revient à l'état antérieur |
| Clé de session Zustand | Nouvelle clé | Supprimer la clé revient à l'état antérieur |

Toute migration fera l'objet d'un test automatique avant son application.

### 2.5 Besoins connus mais non retenus pour l'instant

- **Contenu rédigé pour le classement et l'intrus** : le catalogue l'exige (L9, L10, §4), car `sujet` ne suffit pas à une génération sûre. Son format sera défini avec ces jeux, et son contenu vérifié par le researcher puis par un enseignant. Le quiz définition → mot, lui, s'alimente au vocabulaire.
- **Familles de mots** : jeu de données à préparer par l'educator (décision D8).
