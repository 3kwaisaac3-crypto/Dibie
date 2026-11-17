# Quiz « définition → mot » (moteur D, lot A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le moteur D « Choix » et un premier jeu jouable, le quiz « définition → mot » alimenté par `vocabulaire.json`.

**Architecture:** Un module pur `src/utils/choiceGames.js` contient (1) le moteur générique (état d'une série, réponse à un seul essai, reprise des questions ratées, score), sans connaissance du vocabulaire, et (2) l'adaptateur « définition → mot », qui réutilise `definitionCandidates` et `guaranteedPairCount` de `pairsGame.js` (non modifié) pour garantir qu'aucune proposition n'est une deuxième bonne réponse détectable. Une page `QuizGame.jsx`, calquée sur l'écran de choix de `DefinitionGame.jsx`, affiche la série.

**Tech Stack:** React 18, Vite, Zustand, `node:test` (unitaires), Playwright (bout en bout).

**Spec:** `docs/quiz.md` (lire en entier avant toute tâche).

## Global Constraints

- Répertoire de travail : `files/dibie-app/dibie-app/`, branche `feature/quiz-moteur-d`.
- `src/utils/pairsGame.js` n'est **pas modifié** ; les tests existants (`npm test`, dont les références des anagrammes et des mystères) restent identiques.
- Logique dans `src/utils/` (fonctions pures) ; composants fonctionnels avec hooks ; aucun nombre magique (constantes nommées en `UPPER_SNAKE_CASE`).
- Hors ligne : aucun appel réseau ; même graine, même quiz (`createRandom` de `wordSearchGenerator.js`, `newSeed` / `isValidSeed` réexportés par `pairsGame.js`, `shuffled` de `anagramGame.js`).
- Réglages : CE1-CE2 = 6 questions, 3 propositions ; CM1-CM2 = 8 questions, 4 propositions ; pas de SIL-CP.
- 10 points par bonne réponse du premier essai ; `gameType` = `'quizDefinition'` ; `saveScore` une seule fois par série, détails `{ seed, language, subject, questionCount, correctCount }`.
- Message SIL-CP exact : FR « Ce jeu commence au CE1-CE2 : il faut lire des phrases. Tu peux essayer avec un adulte. » ; EN « This game starts in Class 3-4: you need to read sentences. You can try it with an adult. »
- Textes de l'interface en français et en anglais (`t(fr, en)` comme dans les autres pages).
- Commentaires et messages de commit en français ; commits au format de l'historique (« Ajoute … »).

## Review Focus

- **Sujet contenant deux entrées de même définition** (ex. les deux DOUCHE de CE1-CE2 avant le lot 0) : la série ne doit jamais poser deux fois la même question → test « définitions toutes différentes » (tâche 2).
- **Double toucher sur une proposition, ou toucher après avoir répondu** : la réponse ne change pas et le score ne compte qu'une fois → test moteur « réponse ignorée si déjà répondu » (tâche 1).
- **Série toute juste** : pas de phase de reprise, fin directe → test moteur (tâche 1).
- **Toucher « Suivant » rapidement à la dernière question** : un seul score enregistré → assertion e2e « une seule entrée `quizDefinition` » (tâche 3).
- **Partie en anglais** : définitions et mots anglais, sujets grisés selon la langue → test unitaire sur toute la base en `en` (tâche 2) et partie e2e en anglais (tâche 3).

---

### Task 1: Moteur D générique

**Files:**
- Create: `src/utils/choiceGames.js`
- Test: `src/utils/choiceGames.test.js`

**Interfaces:**
- Consumes: rien des autres tâches.
- Produces (exports de `choiceGames.js`) :
  - `POINTS_PER_QUESTION = 10`
  - type question : `{ id, prompt, options: [{ id, text }], retryOptions: [{ id, text }], answerId, feedback }`
  - type série (« game ») : `{ seed, questions: Question[] }` (champs supplémentaires libres)
  - `createChoiceState(game) → State` ; État : `{ phase: 'main' | 'retry' | 'done', position: number, retryIds: id[], answers: [{ questionId, optionId, correct, phase }] }`
  - `currentQuestion(game, state) → Question | null`
  - `currentOptions(game, state) → Option[]` (`options` en phase `main`, `retryOptions` en phase `retry`, `[]` si fini)
  - `currentAnswer(state) → Answer | null` (réponse déjà donnée à la question en cours, dans la phase en cours)
  - `answerQuestion(game, state, optionId) → State` (renvoie **le même objet** `state` si déjà répondu, si fini, ou si `optionId` n'est pas une proposition affichée)
  - `nextQuestion(game, state) → State` (sans effet, même objet, si la question en cours n'a pas de réponse)
  - `isFinished(state) → boolean` ; `correctCount(state) → number` (phase `main` seulement) ; `missedIds(state) → id[]` (ratées en phase `main`, dans l'ordre) ; `quizScore(state) → number`

- [ ] **Step 1: Write the failing tests** dans `src/utils/choiceGames.test.js` (`node:test`, `assert/strict`), sur une série construite à la main de 3 questions (`q1`, `q2`, `q3`, chacune 3 options `a`/`b`/`c`, `answerId` = `'a'`, `retryOptions` = options dans l'ordre `c, b, a`) :
  - `createChoiceState` : `phase === 'main'`, `position === 0`, `currentQuestion(...).id === 'q1'`, `currentAnswer(state) === null`.
  - « bonne réponse » : `answerQuestion(game, s, 'a')` → `currentAnswer(s2).correct === true` ; `quizScore(s2) === 10`.
  - « réponse ignorée si déjà répondu » : après `'b'` (fausse), `answerQuestion(game, s2, 'a') === s2` (même objet) ; `correctCount === 0`.
  - « option inconnue ignorée » : `answerQuestion(game, s, 'z') === s`.
  - « suivant sans réponse sans effet » : `nextQuestion(game, s) === s`.
  - « reprise des ratées » : q1 juste, q2 faux, q3 faux → après le `nextQuestion` de q3 : `phase === 'retry'`, `currentQuestion.id === 'q2'`, `currentOptions` = `retryOptions` de q2 ; reprise juste sur q2, fausse sur q3 → `isFinished === true`, `correctCount === 1`, `quizScore === 10`, `missedIds` = `['q2', 'q3']`, et q3 n'est pas reproposée une seconde fois.
  - « série toute juste » : trois bonnes réponses → après le dernier `nextQuestion`, `phase === 'done'` directement, `quizScore === 30`.
  - « fini » : `currentQuestion === null`, `currentOptions` = `[]`, `answerQuestion` renvoie le même objet.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/utils/choiceGames.test.js`
Expected: FAIL (module `./choiceGames.js` introuvable).

- [ ] **Step 3: Implement the engine** dans `src/utils/choiceGames.js` avec les signatures ci-dessus. En-tête de commentaire : moteur D du catalogue v0.2 (§0.4), fiche L8, renvoi à `docs/quiz.md`. État immuable (chaque fonction renvoie un nouvel objet, ou le même quand rien ne change, pour que React n'affiche pas de rendu inutile). L'ordre de la reprise est celui de la série principale.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/utils/choiceGames.test.js`
Expected: tous PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/choiceGames.js src/utils/choiceGames.test.js
git commit -m "Ajoute le moteur de choix (moteur D, phase 7, lot A)"
```

---

### Task 2: Questions « définition → mot »

**Files:**
- Modify: `src/utils/choiceGames.js` (ajout d'une section « Quiz définition → mot »)
- Test: `src/utils/quizDefinition.test.js`

**Interfaces:**
- Consumes: tâche 1 (type question) ; de `pairsGame.js` : `definitionCandidates(entries, language)` (candidats `{ id, word, definition, keys, ... }`, `word` déjà en majuscules), `guaranteedPairCount(candidates)`, `isValidSeed` ; `createRandom` (`wordSearchGenerator.js`) ; `shuffled(items, random)` (`anagramGame.js`).
- Produces :
  - `GAME_TYPE_QUIZ_DEFINITION = 'quizDefinition'`
  - `QUIZ_SETTINGS = { 'CE1-CE2': { questionCount: 6, optionCount: 3 }, 'CM1-CM2': { questionCount: 8, optionCount: 4 } }` (gelé) ; `QUIZ_LEVELS = ['CE1-CE2', 'CM1-CM2']`
  - `quizSettings(level) → { questionCount, optionCount }` (RangeError si niveau absent, SIL-CP compris)
  - `quizSubjects(levelEntries, level, language = 'fr') → [{ subject, questions, groups, playable }]` triés par sujet (même tri que `definitionSubjects`) ; `questions` = nombre de définitions distinctes (clés « d: ») parmi les candidats ; `groups` = `guaranteedPairCount(candidates)` ; `playable = questions >= questionCount && groups >= optionCount`
  - `createDefinitionQuiz(entries, level, seed, language = 'fr') → { seed, level, language, questions } | null` (null si le sujet n'est pas jouable ; RangeError si graine invalide ou niveau non proposé). Chaque question : `{ id: candidat.id, prompt: definition, options, retryOptions, answerId: candidat.id, feedback: { word, definition } }`, options `{ id: candidat.id, text: word }`.

Algorithme (non déterminé par les signatures) :

```text
random = createRandom(seed)
pool = shuffled(candidats triés par String(id), random)
réponses = parcours de pool : garder un candidat si sa clé « d: » n'est pas déjà prise ; s'arrêter à questionCount
pour chaque réponse, dans l'ordre :
  choisis = [réponse] ; parcours de shuffled(pool, random) : ajouter c si c ≠ réponse et c ne partage aucune clé
  avec un candidat de choisis ; s'arrêter à optionCount
  options = shuffled(choisis, random) ; retryOptions = shuffled(choisis, random)
```

Le glouton atteint toujours `optionCount` quand `guaranteedPairCount >= optionCount` (le premier candidat rencontré de chaque groupe sans conflit est toujours accepté ou son groupe est déjà représenté) : c'est ce qui rend `playable` sûr pour toute graine.

- [ ] **Step 1: Write the failing tests** dans `src/utils/quizDefinition.test.js` (lecture de `vocabulaire.json` comme `pairsDefinition.test.js` ; `SEEDS = 20`) :
  - `quizSettings` : valeurs exactes de `QUIZ_SETTINGS` ; `assert.throws(() => quizSettings('SIL-CP'), RangeError)`.
  - Petit vocabulaire construit à la main (helper `entry` comme dans `pairsDefinition.test.js`), avec un synonyme qui partage une forme EN (« ADDITIONNER » / « AJOUTER » → `Add`) et deux entrées de même `def_fr` : aucune question n'a ces deux synonymes parmi ses options ; aucune série n'a deux `prompt` identiques.
  - « même graine, même quiz » : `deepEqual` de deux appels ; graine `-1` → RangeError.
  - Sur **toute la base**, pour `language` dans `['fr', 'en']`, niveau dans `QUIZ_LEVELS`, chaque sujet : si `playable`, alors pour les graines `0..SEEDS-1` le quiz n'est pas null et :
    - `questions.length === questionCount`, chaque `options.length === optionCount` et `retryOptions` contient les mêmes ids ;
    - une seule option a l'id `answerId` ; deux options ne partagent aucune clé (`definitionCandidates` du sujet) ;
    - tous les ids d'options appartiennent au sujet et au niveau, et à des entrées `actif !== false` ;
    - `prompt` tous différents dans la série ;
    - le prompt ne révèle pas sa réponse (`definitionRevealsForm(prompt, forme)` faux pour les formes du mot) ;
    - si non `playable` : aucune exigence sur le résultat (la borne est sûre, pas exacte) ; vérifier seulement `playable === (questions >= questionCount && groups >= optionCount)`.
  - Mesure informative (sans assertion de nombre) : afficher avec `console.log` le nombre de sujets jouables par langue et niveau, à recopier dans `docs/quiz.md` §6.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/utils/quizDefinition.test.js`
Expected: FAIL (`quizSettings` non exporté).

- [ ] **Step 3: Implement** `QUIZ_SETTINGS`, `QUIZ_LEVELS`, `GAME_TYPE_QUIZ_DEFINITION`, `quizSettings`, `quizSubjects`, `createDefinitionQuiz` dans `choiceGames.js`, selon l'algorithme ci-dessus.

- [ ] **Step 4: Run tests to verify they pass, then the whole unit suite**

Run: `node --test src/utils/quizDefinition.test.js` puis `npm test`
Expected: tous PASS ; aucun test existant modifié ni en échec.

- [ ] **Step 5: Record the measure** : ajouter à `docs/quiz.md`, fin du §6, un tableau « Mesure sur le vocabulaire (date) » avec les sujets jouables (FR / EN × CE1-CE2 / CM1-CM2) affichés par le test.

- [ ] **Step 6: Commit**

```bash
git add src/utils/choiceGames.js src/utils/quizDefinition.test.js docs/quiz.md
git commit -m "Ajoute les questions définition → mot du quiz (phase 7, lot A)"
```

---

### Task 3: Page du quiz, carte et tests de bout en bout

**Files:**
- Create: `src/pages/QuizGame.jsx`, `src/styles/QuizGame.css`, `e2e/quiz.spec.js`
- Modify: `src/App.jsx` (import ; `'quizGame'` dans `STUDENT_PAGES` et dans la condition de chargement du vocabulaire ligne 70 ; rendu `{page === 'quizGame' && vocabLoaded && <QuizGame />}`)
- Modify: `src/pages/StudentDashboard.jsx` (carte après `pairsDefinition` : `{ id: 'quizDefinition', name: language === 'fr' ? 'Quiz des définitions' : 'Definition quiz', icon: '❓', available: true, page: 'quizGame' }`)
- Modify: `PROJECT_STATUS.md` (ligne « Quiz définition → mot (phase 7, lot A, date, branche `feature/quiz-moteur-d`) » dans les fonctionnalités, avec « choix C1 à C5 provisoires, à valider par Isaac ; à valider par un enseignant ; vrai téléphone non essayé ; voir `docs/quiz.md` »)

**Interfaces:**
- Consumes: tâches 1 et 2 (tous les exports listés) ; `getVocabByLevel`, `saveScore`, `saveUserProgress` (`db/index`) ; `useAppStore` (`user`, `language`, `setCurrentPage`) ; `MATIERES`, `MATIERE_TOUTES`, `filtrerParMatiere`, `libelleMatiere`, `libelleSujet` ; `libelleNiveau` ; `defaultCrosswordSubject`.
- Produces: page `quizGame` ; classes CSS utilisées par l'e2e : `.quiz-board`, `.quiz-question` (le prompt), `.quiz-option` (boutons ; `--correct`, `--wrong` après réponse), `.quiz-feedback` (`role="status"`), `.quiz-next`, `.quiz-retry` (bandeau de la reprise), `.quiz-recap`.

Écran de choix : **reprendre celui de `DefinitionGame.jsx`** (mêmes classes `anagram-select*`, `pairs-select*`, même filtre par matière, même numéro de partie facultatif, même message SIL-CP, mêmes sujets grisés « pas assez de mots »), en remplaçant `definitionSubjects` / `createDefinitionGame` par `quizSubjects` / `createDefinitionQuiz`. Intro FR : « Lis la définition, puis touche le mot qui lui correspond. » ; EN : « Read the definition, then tap the matching word. »

Écran de jeu :
- en-tête : titre, niveau, `.anagram-game__seed` « Partie n° N · Sujet » (comme L4), compteur « Question i / n » (en reprise : bandeau `.quiz-retry` « On revoit les questions ratées » / « Let's review the missed questions ») ;
- `.quiz-question` avec `lang={game.language}` ; propositions `.quiz-option` (texte en majuscules déjà fourni), désactivées après la réponse ;
- bonne réponse : `.quiz-feedback` « Bravo ! » / « Well done! » ; mauvaise : option choisie `--wrong`, bonne option `--correct`, `.quiz-feedback` « La réponse : MOT : définition » / « The answer: WORD: definition » ;
- `.quiz-next` « Suivant » / « Next » visible seulement après la réponse ;
- en phase `main`, chaque réponse appelle `saveUserProgress(user?.id, questionId, correct, null, { gameType: GAME_TYPE_QUIZ_DEFINITION, itemId: questionId })` (comme L4) ;
- à la fin : `saveScore(user?.id, GAME_TYPE_QUIZ_DEFINITION, quizScore(state), level, { seed, language, subject, questionCount, correctCount })` **une seule fois** (garde `useRef` sur l'objet `game`, comme `scoreSavedForRef` de L4), puis écran de fin : score, « n / total bonnes réponses du premier coup », `.quiz-recap` (liste « MOT : définition », ratées marquées), boutons « Rejouer » et « Retour au tableau de bord ».
- CSS : boutons pleine largeur sur téléphone, `min-height: 44px`, texte qui revient à la ligne ; aucune largeur fixe supérieure à 320 px.

- [ ] **Step 1: Write the failing e2e tests** dans `e2e/quiz.spec.js` (modèle : `e2e/paires-definitions.spec.js` ; la série attendue est calculée par `createDefinitionQuiz` avec `vocabulaire` de `./outils.js`) :
  - « Partie complète en français CE1-CE2, toutes justes » : choisir un sujet `playable` (premier de `quizSubjects` jouable, ou `Commerce` s'il l'est), numéro fixe ; pour chaque question, `.quiz-question` = `prompt` attendu, textes des `.quiz-option` = `options` attendues dans l'ordre ; toucher la bonne → « Bravo ! » ; à la fin, pas de bandeau `.quiz-retry`, score 60 affiché, `dibieScores` filtré sur `quizDefinition` de longueur **1** avec `questionCount: 6`, `correctCount: 6`, `language: 'fr'`.
  - « Reprise d'une question ratée » (CM1-CM2) : se tromper à la question 1 (première option fausse) → `.quiz-option--wrong` et `--correct` visibles, feedback « La réponse : … » ; répondre juste aux autres ; après la 8e, `.quiz-retry` visible et `.quiz-question` = prompt de la question 1, options = `retryOptions` ; répondre juste → fin, score 70, une seule entrée de score avec `correctCount: 7`.
  - « Double toucher » : `dblclick` sur la bonne option de la question 1 → toutes les `.quiz-option` sont `toBeDisabled()`, un seul feedback ; finir la série juste : score 60 (CE1-CE2), pas 70.
  - « Partie en anglais » : interface en anglais (même méthode que la partie anglaise de `paires-definitions.spec.js`), prompt = `def_en`, `language: 'en'` dans le score.
  - « Élève de SIL-CP » : message exact des contraintes globales, niveau CE1-CE2 sélectionné, pas de bouton SIL-CP.
  - « 375 et 320 px » : la question la plus longue (plus grand `prompt` sur les graines 0 à 49 du sujet choisi, calculé dans le test) s'affiche sans débordement horizontal (`deborde(page) === false`) et chaque `.quiz-option` mesure au moins 44 px de haut.
  - Chaque test : `suivreErreurs(page)` sans erreur de console.

- [ ] **Step 2: Run e2e to verify it fails**

Run: `npx playwright test e2e/quiz.spec.js`
Expected: FAIL (carte « Quiz des définitions » introuvable).

- [ ] **Step 3: Implement** `QuizGame.jsx`, `QuizGame.css`, les modifications de `App.jsx`, `StudentDashboard.jsx` et `PROJECT_STATUS.md` décrites ci-dessus.

- [ ] **Step 4: Run e2e to verify it passes**

Run: `npx playwright test e2e/quiz.spec.js`
Expected: tous PASS.

- [ ] **Step 5: Full regression**

Run: `npm test && npm run lint && npm run build && npx playwright test`
Expected: tous les tests passent, lint sans erreur, build sans avertissement nouveau de taille de bundle (> 500 KB gzip interdit).

- [ ] **Step 6: Commit**

```bash
git add src/pages/QuizGame.jsx src/styles/QuizGame.css e2e/quiz.spec.js src/App.jsx src/pages/StudentDashboard.jsx PROJECT_STATUS.md
git commit -m "Ajoute la page du quiz des définitions (phase 7, lot A)"
```
