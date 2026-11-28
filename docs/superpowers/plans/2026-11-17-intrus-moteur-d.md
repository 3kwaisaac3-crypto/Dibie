# L'intrus (L9, moteur D) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** jeu « L'intrus » jouable hors ligne, sur le moteur D existant, montrant seulement les items validés par Isaac, avec une fiche imprimable pour cette validation.

**Architecture :** les 60 items vont dans `src/data/intrus.json` (statut par item). `src/utils/intrusGame.js` vérifie les items, filtre par statut (`isVisibleStatus`) et fabrique les questions pour `choiceGames.js` (inchangé) : une question par item en CE1-CE2, deux à la suite (intrus puis « pourquoi ? ») au CM1-CM2. La page `IntrusGame.jsx` reprend la structure de `QuizGame.jsx`.

**Tech Stack :** React 18, Vite, Zustand, `node --test`, Playwright.

**Spec :** `docs/intrus.md` (conception validée par Isaac le 2026-11-17).

## Global Constraints

- Hors ligne ; données embarquées par `import` (comme `grilles-maitre.json`) ; aucun appel réseau.
- Logique pure dans `src/utils/`, testée avec `node --test` ; composants fonctionnels ; aucun nombre magique.
- `src/utils/choiceGames.js` et `src/utils/grillesMaitrePlay.js` : **aucune modification** (import seulement).
- Statuts visibles : « VALIDÉE PAR ISAAC », VALIDÉ, PUBLIÉ (`isVisibleStatus`). Tout item converti reste **BROUILLON** dans ce plan.
- Commits en français, à l'impératif, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Pas de push ni de fusion sans accord d'Isaac.
- Propositions affichées en majuscules (`toLocaleUpperCase` de la langue), comme le quiz (C5).
- Points et essais : ceux du moteur (10 au premier essai, 5 au second, reprise sans points).

## Review Focus

1. **Item non validé visible** : un item BROUILLON ne doit jamais apparaître, ni en série principale ni en reprise → test « items non validés jamais présents » (tâche 2) et e2e « aucun item validé » (tâche 3).
2. **Intrus raté au CM** : la question « pourquoi ? » doit nommer l'intrus et rester répondable → test « CM : intrus nommé dans la seconde question » (tâche 2).
3. **Item mal formé dans une seule langue** (ex. intrus EN absent de la liste EN) : l'item est écarté dans cette langue, pas l'autre → test « item mal formé écarté dans sa langue seulement » (tâche 2).
4. **Moins d'items validés que 6** : partie plus courte, sans plantage → test « partie plus courte » (tâche 2).
5. **Double toucher sur « Suivant »** entre la question intrus et la question « pourquoi ? » → e2e repris de `quiz.spec.js` (tâche 3).

---

### Task 1 : Données des intrus et vérification

**Files :**
- Create : `src/data/intrus.json`
- Create : `src/utils/intrusGame.js` (constantes et vérification seulement)
- Test : `src/utils/intrusData.test.js`

**Interfaces :**
- Produces :
  - `INTRUS_LEVELS = ['CE1-CE2', 'CM1-CM2']` (gelé)
  - `ELEMENTS_PER_ITEM = 4`, `WRONG_REASONS_PER_ITEM = 2`
  - `intrusItemErrors(item, language) -> string[]` (vide si l'item est bien formé dans cette langue)
  - format du JSON : `docs/intrus.md` §5 (`format`, `version`, `source`, `items[]` avec `id`, `niveau`, `matiere`, `critere`, `statut`, `reserve`, `fr`, `en` ; chaque langue : `consigne` (CE), `elements`, `intrus`, `raison`, `raisonsFausses` (CM))

- [ ] **Step 1 : convertir les 60 items.** Script jetable dans le dossier temporaire (pas dans le dépôt) qui lit les tableaux §3.1 et §3.2 de `C:\Users\user\Desktop\JARVIS-ISAAC\DIBIE\contenus\intrus-lot0-v0.1.md` et écrit `src/data/intrus.json`. Règles :
  - intrus = élément en gras (`**…**`), gras retiré ;
  - CE : consigne FR et EN séparées sur « / » ; I-CE-25 a une consigne « FR : … / EN : … » (préfixes retirés) ;
  - CM : pas de consigne ;
  - `reserve` : « — » devient `""` ;
  - `statut` : `"BROUILLON"` pour tous.
- [ ] **Step 2 : rédiger les raisons fausses** (`raisonsFausses`, 2 par langue) des 30 items CM, à la main dans le JSON. Règle I10 : chaque raison est fausse pour cet intrus, plausible, courte, au format « Les trois autres… » ou « X est… » comme la raison juste ; jamais vraie par un autre critère évident. Exemple I-CM-04 (araignée) : « L'araignée est plus grosse que les trois autres. » ; « L'araignée ne vit pas dans les maisons. »
- [ ] **Step 3 : écrire les tests de données** (`src/utils/intrusData.test.js`) sur le vrai fichier :
  - `format === 'dibie-intrus'`, `version === 1` ;
  - `id` uniques ; 30 items `CE1-CE2`, 30 `CM1-CM2` ;
  - chaque statut appartient à `MASTER_GRID_STATUSES` ;
  - pour chaque item et chaque langue (`fr`, `en`) : `assert.deepEqual(intrusItemErrors(item, lang), [], item.id)`.

  Plus des tests unitaires de `intrusItemErrors` sur des items fabriqués, chacun renvoyant au moins une erreur :
  - 3 éléments ;
  - deux éléments égaux sans tenir compte de la casse ;
  - intrus absent des éléments ;
  - raison vide ;
  - CE sans consigne ;
  - CM avec une seule raison fausse ;
  - CM avec une raison fausse égale à la raison juste ;
  - niveau inconnu.
- [ ] **Step 4 : lancer** `node --test src/utils/intrusData.test.js`. Attendu : échec (`intrusItemErrors` absent).
- [ ] **Step 5 : implémenter** les constantes et `intrusItemErrors(item, language)` dans `src/utils/intrusGame.js`. La comparaison des éléments se fait après `trim` et `toLocaleUpperCase`.
- [ ] **Step 6 : lancer** le même test. Attendu : PASS. Puis `npm run lint`. Attendu : 0 erreur.
- [ ] **Step 7 : commit** « Ajoute les 60 intrus du lot 0 (brouillon) et leur vérification », avec `docs/intrus.md` et ce plan.

### Task 2 : Préparation des parties

**Files :**
- Modify : `src/utils/intrusGame.js`
- Test : `src/utils/intrusGame.test.js`

**Interfaces :**
- Consumes :
  - `isVisibleStatus(statut)` de `./grillesMaitrePlay.js` ;
  - `createRandom` de `./wordSearchGenerator.js` ;
  - `shuffled` de `./anagramGame.js` ;
  - `isValidSeed` de `./pairsGame.js` ;
  - format des questions du moteur : `{ id, prompt, options: [{ id, text }], retryOptions, answerId, feedback }` (`docs/quiz.md` §5).
- Produces :
  - `GAME_TYPE_INTRUS = 'intrus'` ;
  - `ITEMS_PER_GAME = { 'CE1-CE2': 6, 'CM1-CM2': 6 }` (gelé, I2) ;
  - `intrusPlayableItems(collection, level, language) -> item[]` : niveau, statut visible, aucune erreur dans la langue ;
  - `createIntrusGame(collection, level, seed, language = 'fr') -> { seed, level, language, itemCount, questions } | null`. RangeError si la graine est invalide ou le niveau hors `INTRUS_LEVELS`. Renvoie `null` si aucun item n'est jouable.
  - Champs d'une question :
    - `kind` : `'intrus'` ou `'pourquoi'` ;
    - `itemId` ;
    - `feedback` : `{ intrus, raison }`.
  - Identifiants :
    - questions : `${id}` et `${id}:pourquoi` ;
    - propositions : `${id}:${index}` pour les mots, `${id}:r${index}` pour les raisons (index dans la liste d'origine, raison juste = `r0`).
  - Prompts :
    - CE : la consigne ;
    - CM intrus : `INTRUS_PROMPT = { fr: 'Trouve l\'intrus.', en: 'Find the odd one out.' }` ;
    - CM pourquoi : `whyPrompt(intrus, language)`, qui donne « Pourquoi X est-il l'intrus ? » / « Why is X the odd one out? », avec X en majuscules.
  - `intrusSummary(collection) -> { [niveau]: { [statut]: nombre } }`.

- [ ] **Step 1 : écrire les tests** (`src/utils/intrusGame.test.js`) avec une petite collection fabriquée : 8 items CE et 8 items CM, dont 6 validés par niveau, les autres BROUILLON ou À VÉRIFIER.
  - `ITEMS_PER_GAME` et `GAME_TYPE_INTRUS` ont les valeurs ci-dessus.
  - Items non validés jamais présents : 100 graines, aucun `itemId` BROUILLON ou À VÉRIFIER.
  - Même graine, même partie (`deepEqual`). Graine `-1` : RangeError. Niveau `SIL-CP` : RangeError.
  - CE : 6 questions, toutes `kind === 'intrus'` ; prompt = consigne ; 4 propositions en majuscules ; `answerId` = l'id du mot intrus ; `feedback.raison` = la raison.
  - CM : 12 questions, en paires `intrus` puis `pourquoi` du même `itemId`. Le prompt de la seconde contient l'intrus en majuscules. Elle a 3 propositions, et la juste a le texte de la raison.
  - Ordre de reprise toujours différent (200 graines, comme `quizDefinition.test.js`).
  - Partie plus courte : avec 3 items CE validés, `itemCount === 3` et 3 questions.
  - Aucun item validé : `null`.
  - Item mal formé écarté dans sa langue seulement : un item validé dont l'intrus EN est absent de la liste EN est présent en `fr` et absent en `en`.
  - Langue : en `en`, les textes viennent de `item.en`.
  - `intrusSummary` sur le vrai fichier : `{ 'CE1-CE2': { BROUILLON: 30 }, 'CM1-CM2': { BROUILLON: 30 } }`. Ce test changera quand Isaac aura validé : le mettre à jour à ce moment.
- [ ] **Step 2 : lancer** `node --test src/utils/intrusGame.test.js`. Attendu : échec.
- [ ] **Step 3 : implémenter** dans `src/utils/intrusGame.js`. Algorithme :
  - trier les items jouables par `id`, les mélanger avec `createRandom(seed)` ;
  - prendre `min(ITEMS_PER_GAME[level], nombre)` items ;
  - pour chaque proposition, mélanger l'ordre ; `retryOptions` reprend la règle `retryOrder` de `choiceGames.js` (remélange, décalage d'un cran si l'ordre est identique). Comme `retryOrder` n'est pas exporté et que `choiceGames.js` ne doit pas changer, la recopier en 4 lignes avec un commentaire qui renvoie à l'original.
- [ ] **Step 4 : lancer** les tests de la tâche, puis `npm test` (attendu : 0 échec) et `npm run lint`.
- [ ] **Step 5 : commit** « Ajoute la préparation des parties de l'intrus (moteur D) ».

### Task 3 : Page, carte et tests de bout en bout

**Files :**
- Create : `src/pages/IntrusGame.jsx`, `src/styles/IntrusGame.css`, `e2e/intrus.spec.js`
- Modify : `src/App.jsx` (`STUDENT_PAGES`, import, rendu `{page === 'intrusGame' && <IntrusGame />}`, sans chargement du vocabulaire) ; `src/pages/StudentDashboard.jsx` (carte après le quiz) ; `PROJECT_STATUS.md` (ligne du lot C)

**Interfaces :**
- Consumes :
  - tout `choiceGames.js` (moteur) ;
  - `createIntrusGame`, `GAME_TYPE_INTRUS`, `INTRUS_LEVELS` (tâche 2) ;
  - `newSeed`, `isValidSeed` de `pairsGame.js` ;
  - `saveScore`, `saveUserProgress` de `../db/index` ;
  - `import collection from '../data/intrus.json'`.
- Produces :
  - carte `{ id: 'intrus', name: fr ? 'L\'intrus' : 'Odd one out', icon: '🧐', available: true, page: 'intrusGame' }` ;
  - classes CSS `.intrus-*` ; les classes `quiz-*` sont réutilisées en important `QuizGame.css`.

- [ ] **Step 1 : écrire `e2e/intrus.spec.js`**, sur le modèle de `e2e/quiz.spec.js` (helpers `toucher`, `repondre`, `rater`, `suivant`, `deborde`, `lireScores`). La partie attendue est recalculée dans le test avec `createIntrusGame(collection, niveau, numero, langue)`, et `collection` est lu avec `readFileSync`. Tests :
  1. Élève SIL-CP : carte visible ; message « Ce jeu commence au CE1-CE2… » ; pas de niveau SIL-CP.
  2. Aucun item validé : message « Pas encore d'intrus validés pour ce niveau. » / « No validated odd-one-out items for this level yet. ». Joué seulement si `intrusPlayableItems(collection, 'CE1-CE2', 'fr').length === 0`, sinon `test.skip` avec cette raison.
  3. Partie CE1-CE2 toute juste :
     - la raison est affichée après chaque réponse ;
     - score `6 × 10` ;
     - un seul `saveScore`, avec `gameType: 'intrus'` et les détails de `docs/intrus.md` §6.
  4. Partie CM1-CM2 :
     - premier intrus raté deux fois ;
     - la question « pourquoi ? » suit et nomme l'intrus ;
     - reprise en fin de partie, sans points ;
     - score attendu calculé.
  5. Double toucher sur « Suivant » entre une question intrus et sa question « pourquoi ? » : celle-ci reste sans réponse.
  6. Partie en anglais (CE1-CE2) : consignes et mots anglais.
  7. 375 et 320 px : pas de débordement (`deborde`).

  Les tests 3 à 7 sont sautés (`test.skip(raison)`) tant que le niveau n'a pas au moins `ITEMS_PER_GAME[niveau]` items jouables.
- [ ] **Step 2 : lancer** `npx playwright test e2e/intrus.spec.js`. Attendu : les tests 1 et 2 échouent (page absente), les tests 3 à 7 sont sautés.
- [ ] **Step 3 : implémenter la page** en reprenant `QuizGame.jsx`, avec ces différences :
  - écran de choix : niveau (`INTRUS_LEVELS`) et numéro seulement (I3) ;
  - SIL-CP : message et niveau CE1-CE2 (I1) ;
  - `createIntrusGame` à la place de `createDefinitionQuiz` ;
  - message « pas encore d'intrus validés » si la partie vaut `null` ;
  - retour après résolution :
    - question `intrus` en CE, ou question `pourquoi` : « Bravo ! » / « Bravo, au deuxième essai ! » / « La réponse : X », suivi de `feedback.raison` ;
    - question `intrus` au CM : « Bravo ! » / « Bravo, au deuxième essai ! » / « L'intrus était : X », sans la raison ;
  - textes anglais sur le modèle du quiz.

  Sont gardés tels quels :
  - le délai de 500 ms (`NEXT_TAP_GUARD_MS`) et la ref contre le double toucher ;
  - un `saveUserProgress` par question résolue en série principale ;
  - un seul `saveScore` (garde par ref), avec `quizScore(state)`.
- [ ] **Step 4 : brancher** `App.jsx`, la carte et `PROJECT_STATUS.md`. Lancer :
  - `npx playwright test e2e/intrus.spec.js` : tests 1 et 2 PASS, 3 à 7 sautés ;
  - `npm run lint` ;
  - `npm run build` : bundle < 500 KB gzip.
- [ ] **Step 5 : vérifier à la main les parties complètes avant le commit.** Copie temporaire du JSON avec 6 items par niveau passés à « VALIDÉE PAR ISAAC », lancer les tests 3 à 7 (attendu : PASS), puis **restaurer le JSON** (`git diff src/data/intrus.json` vide).
- [ ] **Step 6 : commit** « Ajoute la page et la carte de l'intrus ».

### Task 4 : Fiche de validation imprimable (hors dépôt)

**Files :**
- Create (hors dépôt) : `C:\Users\user\Desktop\JARVIS-ISAAC\DIBIE\pedagogie\intrus-validation-lot-c.html` et `.pdf`

- [ ] **Step 1 : générer le HTML depuis `src/data/intrus.json`** avec un script jetable dans le dossier temporaire. Style de `quiz-choix-C1-C8.html`.
  - En-tête : objet, règle de validation, date.
  - Une section par niveau. Pour chaque item :
    - id et matière ;
    - mots FR et EN, intrus en gras ;
    - consigne (CE) ou raison juste et raisons fausses (CM), FR puis EN ;
    - réserve en italique ;
    - cases « Garder / Modifier / Écarter » et une ligne de remarque.
  - Items insécables à l'impression.
  - Pied : nom, date, signature.
- [ ] **Step 2 : imprimer en PDF** avec Edge sans interface : `msedge --headless --no-pdf-header-footer --print-to-pdf=<pdf> <html>`. Relire le PDF : 60 items, aucun coupé.
- [ ] **Step 3 : pas de commit** (fichiers hors dépôt).

## Fin

- Relecture de toute la branche par un relecteur neuf, avec la section Review Focus ; corrections Critical et Important, chacune avec un test vu en échec.
- Régression complète : `npm test`, `npm run lint`, `npm run build`, `npx playwright test`.
- Proposer la pull request à Isaac. La fusion attend la validation des items (`docs/intrus.md` §8) : statuts reportés, test `intrusSummary` mis à jour, tests e2e 3 à 7 rejoués.
