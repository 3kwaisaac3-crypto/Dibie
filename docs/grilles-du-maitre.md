# Grilles du maître (fiche L16, phase 6) : note de conception des lots A et B

- **Date** : 2026-11-09
- **Statut** : lot A (importateur et vérificateur, **sans interface**) fusionné (pull request n° 31, `603393b`), relu par le reviewer le 2026-11-09 (un passage, PRÊT). **Lot B** (rubrique et affichage, §8) sur la branche locale `feature/grilles-maitre-lot-b` : pas de commit ; relu une fois par le reviewer le 2026-11-09 (NON PRÊT, une réserve : grilles au statut BROUILLON montrées aux élèves), réserve corrigée après la décision d'Isaac (§8.7), correction non relue ; pas d'essai sur vrai téléphone. Non validé par un enseignant (D14).
- **Sources des règles** (dépôt JARVIS) : `DIBIE/pedagogie/cadrage-phase6-grilles-maitre-v0.1.md` (VALIDÉ, P1 à P12 option a) ; `DIBIE/jeux/grilles-du-maitre/selection-lot0-v0.1.md` (VALIDÉ : 12 grilles, corrections C1 à C18 et C25 à C32) ; relevé `DIBIE/jeux/grilles-du-maitre/releve-grilles-2026-11-09.json` (empreintes).

## 1. Fichiers

| Fichier | Rôle |
|---|---|
| `scripts/grilles-maitre-selection.js` | Fiches des 12 grilles : chemins, empreinte SHA-256 attendue, matière, niveau, rattachement au programme, corrections acceptées (fragment exact « avant » → « après ») |
| `scripts/grilles-maitre-import.js` | Importateur, lancé à la main au moment du développement (jamais dans l'application). Lecture seule des .ecw ; écrit seulement `src/data/grilles-maitre.json` (refus sur H: ou J:) |
| `src/utils/grillesMaitreImport.js` | Fonctions pures : conversion cp1252, lecture du .ecw, reconstruction, recadrage, numérotation, corrections, normalisation |
| `src/utils/grillesMaitre.js` | Vérificateur indépendant de l'importateur (`verifyMasterGrid`, `verifyMasterCollection`) ; statuts ; détection d'un texte mal converti |
| `src/utils/grillesMaitre.test.js` | Tests unitaires (49) |
| `src/data/grilles-maitre.json` | Données des 12 grilles, UTF-8, généré : **ne pas modifier à la main** |
| `scripts/grilles-maitre-echantillon.js` | Échantillon Markdown pour l'educator et Isaac, à partir du fichier de données |

Commandes (depuis la racine du projet) :

```
node scripts/grilles-maitre-import.js --date 2026-11-09
node scripts/grilles-maitre-echantillon.js <fichier.md>
npm test
```

## 2. Chaîne d'importation

```
fiche de sélection (chemin, sha256 attendu, corrections)
  readFileSync (lecture seule) -> SHA-256 comparé au relevé (arrêt si différent)
  decodeEcw   : cp1252 -> texte ; refus si U+FFFD, octet non défini, ou UTF-8 lu en cp1252
  parseEcw    : en-tête (Title, Width, Height, Author, Copyright), version du logiciel, mots
                (MOT: x, y: définition ; x = colonne, y = ligne, base 1) ; toute ligne inconnue = erreur
  buildGrid   : chaque caractère de la réponse occupe une case (tiret compris) ; refus si
                conflit de lettres, sortie de la grille déclarée, espace, apostrophe, chiffre, Œ / Æ ;
                recadrage sur la zone occupée ; numéros 1..N dans l'ordre de lecture
                (départ partagé = même numéro, comme numberClues des mots croisés)
  corrections : fragment exact présent UNE fois, sinon erreur (rien n'est improvisé)
  normalisation : espaces multiples et de bordure (journalisée)
  verifyMasterCollection -> fichier écrit seulement si les 12 grilles sont valides
```

## 3. Format des données (`format: "dibie-grilles-maitre"`, `version: 1`)

Par grille : les métadonnées du cadrage §4.1 (`id`, `titre`, `titreOrigine`, `matiere`, `niveau` (`SIL-CP` / `CE1-CE2` / `CM1-CM2`), `niveauStatut`, `classe`, `sous_systeme`, `langue` (`fr` / `en`), `theme`, `competence`, `objectif`, `difficulte`, `type_activite`, `ligne_programme`, `auteur`, `copyright`, `droits`, `statut`, `validation` (`par`, `date`, `mention`, `reference` ; ajouté au lot B, `null` si la grille n'est pas validée)), `source` (`chemin`, `copies`, `sha256`, `octets`, `logiciel`, `tailleDeclaree`, `dateImport`), `largeur`, `hauteur`, `lignes` (une chaîne par ligne : `.` case vide, `-` tiret, `A-Z` lettre), `mots`, `corrections`, `normalisations`.

Par mot : `id` (grille + numéro + sens, ex. `G017-2V`, identifiant de progression prévu par P12), `numero`, `direction` (`across` / `down`, comme `dir` des mots croisés), `ligne`, `colonne` (base 0, grille recadrée), `reponse` (avec accents, telle que dans le fichier), `grille` (cases : sans accents), `longueur`, `definition` (texte affiché), `definitionOrigine` (texte du fichier, converti en UTF-8, jamais modifié), `positionSource`.

## 4. Inventaire technique de la grille des mots croisés (P7, constat seul)

Rien n'est modifié dans l'écran au lot A.

| Contrainte | Où | Effet pour les Grilles du maître |
|---|---|---|
| `GRID_SIZE = 15` | `crosswordLayout.js` (générateur `ProGridGenerator`, bornes, numérotation) | Le générateur n'est pas utilisé par les grilles fixes : aucun changement nécessaire |
| Flèches du clavier bornées par `GRID_SIZE` | `EclipseGrid.jsx`, l. 133 à 144 | À remplacer par la taille réelle (`grid.length`, `grid[0].length`) pour une grille rectangulaire |
| **15 colonnes et 15 lignes codées en dur** | `EclipseGrid.css` : `repeat(15, 40px)` (l. 60-61), `repeat(15, 35px)` (l. 238-239), `repeat(15, var(--eclipse-case))` et taille de case `/ 15` (l. 272-277) | Principal obstacle : il faudrait des variables CSS (nombre de colonnes et de lignes) posées par le composant |
| `MAX_WORD_LENGTH = 13` | `selectCrosswordWords` (vocabulaire seulement) | Ne s'applique pas aux grilles importées ; mot le plus long du lot : 12 lettres (DÉMANGEAISON, BALLONNEMENT) |
| Tirets, espaces, apostrophes écartés | `sanitizeWord` (vocabulaire seulement) | Les grilles importées gardent le tiret comme case. `EclipseGrid` fait de toute case non vide un champ de saisie : une case fixe (non saisissable) serait à ajouter. **Aucune réponse à tiret dans les 12 grilles du lot** |
| Comparaison sans accents | `normalizeTypedLetter`, `isWordComplete` | Compatible : les cases des données sont sans accents, la réponse accentuée reste disponible pour l'affichage final |
| Entrée du composant : `game = { wordsData, grid, placements }` | `EclipseGrid.jsx` | Conversion simple depuis les données (`lignes` -> tableau, `.` -> `null`) ; `onAnswerCorrect(wordId)` attend un identifiant du vocabulaire : à séparer (P12, `gameType` propre) |

Taille variable : **raisonnable** d'après ce constat (CSS paramétré, bornes des flèches, case fixe), à confirmer au lot B avec les tests de non-régression des mots croisés et un essai à 320 et 375 px. **Repli possible sans toucher au CSS** : les 12 grilles font toutes au plus 15 × 15, elles pourraient être placées dans une grille de 15 × 15 complétée de cases vides (P7 b).

Tailles recadrées (largeur × hauteur, calculées par l'importateur, identiques au relevé) : G173 12 × 13 ; G172 11 × 14 ; G093 13 × 10 ; G085 13 × 15 ; G140 11 × 15 ; G183 12 × 13 ; G180 12 × 13 ; G153 12 × 15 ; G168 11 × 12 ; G017 10 × 10 ; G018 8 × 12 ; G019 9 × 10.

## 5. Tests

`src/utils/grillesMaitre.test.js` : encodage (cp1252, refus d'un UTF-8 lu en cp1252), lecture du .ecw, tiret comme case (cas synthétique CERF-VOLANT), accents, conflits et caractères refusés, recadrage et numérotation (départ partagé), corrections (fragment absent ou répété refusé), normalisation, 12 grilles présentes et tailles, 0 conflit, liste exacte des corrections, **un test par correction** (27 entrées : C9 porte sur deux mots), définitions relues mot pour mot, métadonnées, empreintes, détection des altérations par le vérificateur. Un test refait l'import depuis J: et compare au fichier versionné ; il est **sauté** si les fichiers sources ne sont pas accessibles (il a tourné le 2026-11-09).

Pas de test navigateur : il n'y a aucune interface au lot A.

## 6. Choix provisoires du developer (à présenter à Isaac)

1. **Emplacement** : données dans `src/data/grilles-maitre.json` (comme `vocabulaire.json`, embarqué, hors ligne) ; importateur et fiches dans `scripts/` (outils de développement).
2. **Identifiant de grille** = numéro du relevé du 2026-11-09 (`G173`…), versionné dans le dépôt JARVIS ; identifiant de mot = grille + numéro + sens (`G017-2V`).
3. **Texte d'origine conservé pour tous les mots** (`definitionOrigine`), et non seulement pour les mots corrigés.
4. **Normalisation typographique** limitée aux espaces multiples et de bordure, titres compris (« plural MCQ  2 » devient « plural MCQ 2 ») ; journalisée dans `normalisations`. Dans G168, les doubles espaces séparaient les choix A), B), C) : l'affichage HTML les réduisait de toute façon à une seule.
5. **C16** : le document de sélection cite « qu'on » (apostrophe droite), le fichier porte « qu’on ». Le fragment remplacé s'arrête avant l'apostrophe, qui reste celle du fichier. Le texte corrigé est celui qui a été accepté.
6. **C9** porte sur deux mots (COR et LA) : deux entrées de même identifiant.
7. **Réponses refusées au lot A** : espace, apostrophe, chiffre, ligatures Œ / Æ (comportement d'EclipseCrossword non vérifié, sauf le tiret) ; aucune n'apparaît dans les 12 grilles.
8. **Champs non renseignés** (`null`) : `competence`, `objectif`, `difficulte` partout ; `classe` sauf G173, G172 (CM2) et G153 (CM1) ; `sous_systeme` sauf G153 (francophone) ; `ligne_programme` pour G017 à G019. À renseigner par Isaac et l'educator.
9. **Statuts** : `BROUILLON`, `À VÉRIFIER`, `VALIDÉE PAR ISAAC`, `VALIDÉ`, `PUBLIÉ` ; les 12 grilles, importées en `BROUILLON` au lot A, sont passées à `VALIDÉE PAR ISAAC` au lot B (décision d'Isaac du 2026-11-09, §8.7).
10. **Droits** : `déclarés par Isaac` (2026-11-09) pour les 12 ; pour G168, remarque : extension de la déclaration aux plural MCQ DÉDUITE, à confirmer.
11. **Date d'import** passée en option (`--date`) pour qu'un nouvel import donne un fichier identique.
12. Pas d'alertes calculées dans les données (réponse dans la définition, mots de 2 lettres) : elles figurent déjà dans le relevé du lot 0.

## 7. Points ouverts

- Niveau des grilles G017 à G019 : proposition de l'educator, à confirmer par Isaac.
- Consignes à afficher (G153 « Write the simple past of the verb ») : proposition du lot 0, non décidée, non intégrée.
- Lot B : affichage (P7), carte du tableau de bord (P9), points et enregistrement (P10, P12) : voir §8.

## 8. Lot B : rubrique et affichage (2026-11-09)

Lancé sur instruction d'Isaac du 2026-11-09 (« Lance le lot B »). Décisions appliquées (cadrage de la phase 6, option a) : P7 (grille des mots croisés de taille variable, mots croisés générés inchangés), P9 (élèves seuls, D11), P10 (mot signalé dès qu'il est juste, 10 points par mot), P11 (titre « Grilles du maître — Préparation aux examens », aucun examen nommé), P12 (`gameType` propre, progression par mot, identifiant = grille + numéro + sens, aucun nouveau badge).

### 8.1 Fichiers

| Fichier | Changement |
|---|---|
| `src/utils/grillesMaitrePlay.js` | **Nouveau**. Fonctions pures : liste par niveau (`masterGridsForLevel`), matières, libellés FR / EN, conversion d'une grille vers la forme attendue par `EclipseGrid` (`toEclipseGame`), score, seuil de « Terminer ». Constantes `GAME_TYPE_MASTER_GRID = 'masterGrid'`, `POINTS_PER_WORD = 10` |
| `src/utils/grillesMaitrePlay.test.js` | **Nouveau**. 13 tests, dont 2 de non-régression des mots croisés générés (§8.4) |
| `src/pages/MasterGridGame.jsx` | **Nouveau**. Écran : liste (niveau du profil, filtre par matière), partie, fin |
| `src/styles/MasterGridGame.css` | **Nouveau**. Liste et en-têtes ; les écrans réutilisent les classes de `CrosswordGame.css` |
| `src/components/EclipseGrid.jsx` | Taille lue dans `game.grid` : bornes des flèches (au lieu de `GRID_SIZE`) et variables CSS `--eclipse-cols`, `--eclipse-rows` posées sur `.eclipse-grid` ; titre facultatif `title` (absent aux mots croisés : titre inchangé) |
| `src/styles/EclipseGrid.css` | `repeat(15, …)` et `/ 15` remplacés par `var(--eclipse-cols, 15)` et `var(--eclipse-rows, 15)` (valeur 15 par défaut) |
| `src/pages/StudentDashboard.jsx` | Carte « Grilles du maître » / « Teacher's grids » (📝) |
| `src/App.jsx` | Page `masterGridGame` (élève), sans attente du vocabulaire |
| `e2e/grilles-maitre.spec.js` | **Nouveau**. 12 tests × 3 projets (§8.4) |

`crosswordLayout.js` (générateur des mots croisés) et `CrosswordGame.jsx` ne sont **pas modifiés**.

### 8.2 Déroulement

- **Carte** au tableau de bord élève, visible à tous les niveaux. La page lit le niveau du profil ; en SIL-CP (aucune grille), message « Pas encore de grille pour ton niveau. ».
- **Liste** : grilles du niveau du profil (CE1-CE2 : 5 ; CM1-CM2 : 7), avec pour chacune le titre de l'auteur, la matière, le nombre de mots et la langue ; filtre « Toutes » + matières présentes.
- **Partie** : grille des mots croisés (`EclipseGrid`) à la taille de la grille recadrée ; saisie, avance automatique, flèches, retour arrière et comparaison sans accents **identiques** aux mots croisés ; mot signalé dès qu'il est juste ; mot perdu si une de ses lettres est effacée ou remplacée (−10 points).
- **Enregistrement** :
  - progression : une ligne par mot trouvé, `saveUserProgress(userId, null, true, null, { gameType: 'masterGrid', itemId: 'G017-2V' })` ;
  - score : `saveScore(userId, 'masterGrid', score, niveau, { gridId, gridTitle, matiere, langue, statut, wordCount, wordsFound })`, **une seule fois par partie** : dès le dernier mot trouvé (message « Grille terminée ! N points enregistrés. ») ou à « Terminer » (visible à partir de 70 % des mots, comme les mots croisés) ;
  - aucun badge ajouté (`getUserStats` inchangé ; les badges existants, communs à tous les jeux, s'appliquent comme avant).

### 8.3 Mesure de la taille des cases (navigateur, pas téléphone)

Mesurée par `e2e/grilles-maitre.spec.js` dans Microsoft Edge (Playwright), fenêtre de **320 × 640**, sur les 3 projets (mêmes valeurs) :

| Grille | Taille | Case mesurée | Calcul (`min(26, (320 − 32 − 12) / colonnes)`) |
|---|---|---|---|
| G085 (plus grande : 13 colonnes) | 13 × 15 | **21,22 × 21,22 px** | 21,23 |
| G140 | 11 × 15 | **25,08 × 25,08 px** | 25,09 |
| Mots croisés générés (référence, inchangée) | 15 × 15 | 18,39 px | 18,40 |

Aucun débordement horizontal ; grille entière dans la largeur (de 16,1 à 303,9 px). **Non mesuré sur vrai téléphone** : essai d'Isaac à faire (320 et 375 px, cadrage §5.3).

### 8.4 Tests (résultats du 2026-11-09, branche `feature/grilles-maitre-lot-b`)

- `src/utils/grillesMaitrePlay.test.js` : 13/13 (dont le filtre des statuts visibles, ajouté après la décision d'Isaac). Non-régression des mots croisés générés : empreinte SHA-256 des grilles produites par `createCrosswordGame` pour **tous les sujets** des 3 niveaux, les 3 types et la graine 12345 (321 grilles), calculée sur `main` (`603393b`) avant toute modification, identique après ; et grilles toujours 15 × 15.
- `e2e/grilles-maitre.spec.js` : 36/36 (12 tests × ordinateur, tablette, téléphone) : carte FR / EN, liste et filtre, SIL-CP, partie complète G017 (100 points, un seul score, 10 lignes de progression aux bons identifiants), accents et effacement (G085), flèches (G093), 320 × 640 (G085, G140), et taille des cases des mots croisés à 320, 375, 768 et 1 280 px égale aux mesures prises sur `main` avant le lot B (18,39 / 22,06 / 26 / 40 px).
- `e2e/mots-croises.spec.js` (non-régression) : 24/24.
- Second passage du reviewer : test « À 320 × 640 » instable (58/60), le clic sur une case étant intercepté par son numéro `.eclipse-number`. Correction : `pointer-events: none` sur `.eclipse-number` (`EclipseGrid.css`, partagé avec les mots croisés).
- `npm test` : 359 tests, 357 réussis, 0 échec, 2 ignorés (anciens). Lint : 0 erreur. Build : réussi (avertissement habituel de Vite sur un bloc de plus de 500 kB).
- Suite Playwright complète : **non lancée** (consigne du lot).

### 8.5 Choix provisoires du developer (à confirmer par Isaac)

1. **Langue des grilles** : toutes les grilles du niveau sont proposées, **quelle que soit la langue de l'interface** ; chaque grille reste dans la langue de son auteur (pas de traduction), sa langue est indiquée (« en anglais », « in French »), et les grilles dans la langue de l'interface viennent en premier. Une phrase le rappelle sous la liste. Raison : une grille anglaise est utile à un élève francophone (et inversement), et le premier lot n'a que 5 grilles par niveau au plus.
2. **Niveau** : celui du profil seulement, sans choix à l'écran (comme les nombres croisés) ; aucune grille en SIL-CP, d'où un message.
3. **Statut** — **n'est plus un choix provisoire : décision d'Isaac du 2026-11-09** (« Je valide les 12 »), après la réserve du reviewer (contraire au cadrage §4.1). Seules les grilles au statut `VALIDÉE PAR ISAAC` ou plus (`VALIDÉ`, `PUBLIÉ`) sont proposées aux élèves ; `BROUILLON` et `À VÉRIFIER` n'apparaissent jamais. Les 12 grilles sont `VALIDÉE PAR ISAAC` ; usage avec des élèves réels après validation par un enseignant (D14). Le statut est enregistré avec le score.
4. **Nom du `gameType`** : `masterGrid`.
5. **Libellés anglais** : carte « Teacher's grids », titre « Teacher's grids — Exam preparation », matières « French », « English », « Mathematics », « Science (health) / vocabulary ».
6. **En-têtes HORIZONTALEMENT / VERTICALEMENT** et boutons dans la langue de l'interface, même pour une grille d'une autre langue.
7. **Score enregistré une seule fois** : au dernier mot trouvé (automatiquement) ou à « Terminer » (dès 70 % des mots, comme les mots croisés). Après l'enregistrement, effacer une lettre ne retire plus de points.
8. **Progression** : `wordId` à `null` et identifiant du mot dans `itemId` (comme les nombres croisés), pour ne pas mêler ces identifiants à ceux du vocabulaire.
9. **« Retour » pendant la partie** : revient à la liste sans confirmation ni enregistrement, comme les mots croisés.
10. **Cases fixes (tiret)** : non prises en charge à l'écran ; une grille qui en contient n'est pas proposée (aucune dans le premier lot).
11. **Réponses avec accents à la fin** (hypothèse du cadrage §2.4) : non affichées au lot B ; l'écran de fin donne le score et le nombre de mots trouvés.
12. **Consignes** (ex. G153 « Write the simple past of the verb ») : non affichées (point ouvert du §7, non décidé).

### 8.6 Limites et points ouverts du lot B

- Pas d'essai sur vrai téléphone ; mesure en navigateur seulement (§8.3).
- Correction de la réserve du reviewer (§8.7) non relue.
- La ligne de progression d'un mot perdu (lettre effacée) n'est pas retirée, comme aux mots croisés.
- Les mots croisés et les Grilles du maître partagent `EclipseGrid` : toute modification future du composant doit relancer `e2e/mots-croises.spec.js` et `e2e/grilles-maitre.spec.js`.

### 8.7 Correction après la relecture du reviewer (2026-11-09)

- Réserve du reviewer (NON PRÊT) : grilles au statut `BROUILLON` montrées aux élèves, contraire au cadrage §4.1. Décision d'Isaac du 2026-11-09 : « Je valide les 12 ».
- **À la source** : `scripts/grilles-maitre-selection.js` donne aux 12 fiches `statut: 'VALIDÉE PAR ISAAC'` et `validation: { par: 'Isaac', date: '2026-11-09', mention: 'validé par Isaac', reference: '« Je valide les 12 » (décision d\'Isaac du 2026-11-09)' }` ; l'importateur (`grillesMaitreImport.js`) recopie `validation` ; `src/data/grilles-maitre.json` régénéré par `node scripts/grilles-maitre-import.js --date 2026-11-09` (vérification : ok ; seuls `statut` et `validation` changent).
- **À l'écran** : `isVisibleStatus` / `MIN_VISIBLE_STATUS` (`grillesMaitrePlay.js`) ; `masterGridsForLevel` écarte `BROUILLON` et `À VÉRIFIER` (test unitaire dédié ; test des métadonnées du lot A adapté ; e2e : statut enregistré avec le score).
