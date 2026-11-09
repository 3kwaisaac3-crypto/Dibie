# Grilles du maître (fiche L16, phase 6) : note de conception du lot A

- **Date** : 2026-11-09
- **Statut** : lot A (importateur et vérificateur, **sans interface**) sur la branche `feature/grilles-maitre-lot-a`. Relu par le reviewer le 2026-11-09 (un passage, PRÊT, aucune réserve substantielle). Pas encore de commit. Non validé par un enseignant (D14).
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

Par grille : les métadonnées du cadrage §4.1 (`id`, `titre`, `titreOrigine`, `matiere`, `niveau` (`SIL-CP` / `CE1-CE2` / `CM1-CM2`), `niveauStatut`, `classe`, `sous_systeme`, `langue` (`fr` / `en`), `theme`, `competence`, `objectif`, `difficulte`, `type_activite`, `ligne_programme`, `auteur`, `copyright`, `droits`, `statut`), `source` (`chemin`, `copies`, `sha256`, `octets`, `logiciel`, `tailleDeclaree`, `dateImport`), `largeur`, `hauteur`, `lignes` (une chaîne par ligne : `.` case vide, `-` tiret, `A-Z` lettre), `mots`, `corrections`, `normalisations`.

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
9. **Statuts** : `BROUILLON`, `À VÉRIFIER`, `VALIDÉE PAR ISAAC`, `VALIDÉ`, `PUBLIÉ` ; les 12 grilles sont en `BROUILLON`.
10. **Droits** : `déclarés par Isaac` (2026-11-09) pour les 12 ; pour G168, remarque : extension de la déclaration aux plural MCQ DÉDUITE, à confirmer.
11. **Date d'import** passée en option (`--date`) pour qu'un nouvel import donne un fichier identique.
12. Pas d'alertes calculées dans les données (réponse dans la définition, mots de 2 lettres) : elles figurent déjà dans le relevé du lot 0.

## 7. Points ouverts

- Niveau des grilles G017 à G019 : proposition de l'educator, à confirmer par Isaac.
- Consignes à afficher (G153 « Write the simple past of the verb ») : proposition du lot 0, non décidée, non intégrée.
- Lot B : affichage (P7), carte du tableau de bord (P9), points et enregistrement (P10, P12).
