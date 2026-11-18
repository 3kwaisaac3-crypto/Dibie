# Calcul mental (M6) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** jeu « Calcul mental » hors ligne, réglé sur la classe du profil (12 classes), saisie au pavé, indice après 2 erreurs, « Voir la réponse » après 3.

**Architecture :** `src/data/calcul-mental.js` décrit les familles et les bornes de chaque classe (recopie du lot 0). `src/utils/mentalMath.js` énumère les calculs d'une famille, tire les séries selon la graine et suit les réponses (module pur). La page `MentalMathGame.jsx` réutilise `NumberPad` et `resolveMathClass`.

**Tech Stack :** React 18, Vite, Zustand, `node --test`, Playwright.

**Spec :** `docs/calcul-mental.md` (validée par Isaac le 2026-11-17). Source des bornes : `C:\Users\user\Desktop\JARVIS-ISAAC\DIBIE\pedagogie\calcul-mental-familles-lot0-v0.1.md` §2.1 et §2.2.

## Global Constraints

- Hors ligne ; logique pure dans `src/utils/`, testée avec `node --test` ; composants fonctionnels ; aucun nombre magique.
- `src/data/reglages-maths.js` et `src/components/NumberPad.jsx` : **aucune modification** (import seulement).
- Bornes : copie exacte des tableaux du lot 0. En tête du fichier : « PROVISOIRE, SANS SOURCE, à valider par un enseignant (D4) ».
- Règles du spec §4 : entiers positifs, soustraction ≥ 1, divisions exactes, pas de + 0 ni de × 0 / × 1, multiplicateur des tables de 2 à 10, aucun calcul répété dans une série, aucun nombre affiché au-dessus du `maxNumber` de la classe, aucun mot en SIL et Class 1.
- Grands nombres groupés par trois avec une espace insécable (`\u00A0`), dans les deux langues (M9).
- Commits en français, à l'impératif, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Pas de push ni de fusion sans accord d'Isaac.

## Review Focus

1. **Classe du profil absente ou incohérente** (profil sans classe, classe d'un autre niveau) : la page joue la classe par défaut et le dit → e2e « profil sans classe » (tâche 3).
2. **Réponse saisie trop longue ou vide** : ✓ désactivé sur une saisie vide ; saisie limitée au nombre de chiffres de la plus grande réponse de la série → test `maxDigits` (tâche 2) et e2e (tâche 3).
3. **Mélange d'une classe à 3 familles (Class 1)** : 10 calculs distincts, chaque famille présente → test « mélange » (tâche 2).
4. **Tentative après « Voir la réponse »** : sans effet, 0 point → test « réponse vue puis saisie » (tâche 2).
5. **Double toucher sur « Suivant »** : le calcul suivant reste sans réponse → e2e (tâche 3).

---

### Task 1 : Réglages et énumération des calculs

**Files :**
- Create : `src/data/calcul-mental.js`, `src/utils/mentalMath.js` (énumération et affichage)
- Test : `src/utils/mentalMathFamilies.test.js`

**Interfaces :**
- Consumes : `MATH_CLASSES` (`../data/reglages-maths.js`), pour `className`, `subsystem` et `maxNumber`.
- Produces :
  - `MENTAL_MATH_CLASSES` (gelé), dans `src/data/calcul-mental.js` : `{ [className]: { [familyId]: form[] } }`. La forme exacte des objets `form` est libre ; leur `type` vaut l'un de `add`, `sub`, `complement`, `double`, `half`, `triple`, `third`, `quadruple`, `quarter`, `table`, `timesPow10`, `divPow10`, `timesK`, `missingFactor`.
  - `FAMILY_IDS = ['A','B','C','D','E','F','G','H','I']` ; `familyName(id, language)`. Noms FR / EN :
    - A : Additions / Additions ;
    - B : Soustractions / Subtractions ;
    - C : Compléments / Number bonds ;
    - D : Doubles et moitiés / Doubles and halves ;
    - E : Triples, quadruples, tiers, quarts / Triples, quadruples, thirds, quarters ;
    - F : Tables / Times tables ;
    - G : × et ÷ par 10, 100, 1 000 / × and ÷ by 10, 100, 1,000 ;
    - H : Produits particuliers / Special products ;
    - I : Facteur manquant / Missing factor.
  - `classFamilies(className) -> string[]` : lettres dans l'ordre A à I ; `[]` pour une classe inconnue.
  - `familyCalcs(className, familyId) -> calc[]` : tous les calculs distincts, triés par `id`.
    - Un `calc` vaut `{ id, family, type, a, b, k, answer, shown }`. `shown` liste les nombres affichés, pour le contrôle de `maxNumber`.
    - L'`id` est unique par texte affiché : `${type}:${a}:${b ?? ''}:${k ?? ''}`.
  - `calcText(calc, language) -> string`. Formes du spec §6.1 : `a + b = ?`, `a − b = ?` (signe U+2212), `a + ? = n`, `Double de a` / `Double of a`, `a × b = ?`, `a ÷ 10 = ?`, `a × ? = c`. Les nombres passent par `formatNumber`.
  - `formatNumber(n) -> string` : par exemple `4\u00A0500` et `999\u00A0000`.

- [ ] **Step 1 : écrire les tests** (`src/utils/mentalMathFamilies.test.js`).
  - Familles par classe = tableau du spec §3, par exemple `classFamilies('SIL')` → `['A','B','C','F']`, `classFamilies('CM1')` → `['A','B','C','D','F','G','H','I']`, `classFamilies('Class 1')` → `['A','B','C']`. Assertion sur les 12 classes.
  - Toutes les classes de `MATH_CLASSES` (fr et en) ont une entrée.
  - Pour chaque classe et chaque famille, contrôlés sur tous les calculs énumérés :
    - `familyCalcs(...).length >= 9` ;
    - `answer` est un entier ≥ 1 ;
    - chaque nombre de `shown` est un entier ≥ 1 et ≤ `maxNumber` de la classe ;
    - `table` : multiplicateur de 2 à 10, et aucun facteur 1 ;
    - `divPow10` : division exacte ;
    - `id` uniques ;
    - les `calcText` sont uniques dans la famille.
  - SIL et Class 1 : `calcText(c, 'fr')` et `calcText(c, 'en')` correspondent à `/^[0-9 \u00A0+−×÷?=]+$/`.
  - Contrôles ponctuels du lot 0 :
    - SIL C : 9 calculs, `a + ? = 10` avec a de 1 à 9 ;
    - SIL F : 9 calculs, `2 × a`, a de 2 à 10 ;
    - CP D : moitié de 4 à 40, nombres pairs seulement ;
    - CE1 E : tiers de 6 à 30 ;
    - CM1 I : c ≤ 100, réponse de 2 à 10 ;
    - CM2 H, × 25 : a de 2 à 12, résultat ≤ 300 ;
    - CM1 G, quotient : résultat de 2 à 999.
  - `formatNumber(4500) === '4\u00A0500'` ; `formatNumber(999000) === '999\u00A0000'` ; `formatNumber(56) === '56'`.
  - `calcText` : `missingFactor` 7 / 56 donne `'7 × ? = 56'` ; `half` 18 donne `'Moitié de 18'` en `fr` et `'Half of 18'` en `en`.
- [ ] **Step 2 : lancer** `node --test src/utils/mentalMathFamilies.test.js`. Attendu : échec, module absent.
- [ ] **Step 3 : implémenter.**
  - Recopier les tableaux §2.1 et §2.2 du lot 0 dans `calcul-mental.js`, case par case. Chaque forme garde un commentaire de la case d'origine.
  - Écrire l'énumération par type dans `mentalMath.js`. Les plafonds du résultat (« résultat ≤ 20 ») sont des filtres de l'énumération.
  - CP et Class 2, C « dizaine qui suit a » : n = ⌈a / 10⌉ × 10, avec a non multiple de 10.
- [ ] **Step 4 : lancer** le test (attendu : PASS), puis `npm run lint`.
- [ ] **Step 5 : commit** « Ajoute les familles du calcul mental et leur énumération », avec `docs/calcul-mental.md` et ce plan.

### Task 2 : Séries, réponses et indices

**Files :**
- Modify : `src/utils/mentalMath.js`
- Test : `src/utils/mentalMath.test.js`

**Interfaces :**
- Consumes :
  - tâche 1 (`familyCalcs`, `classFamilies`) ;
  - `createRandom` (`./wordSearchGenerator.js`), `shuffled` (`./anagramGame.js`), `isValidSeed` (`./pairsGame.js`).
- Produces :
  - Constantes : `GAME_TYPE_MENTAL_MATH = 'mentalMath'`, `SERIES_LENGTH = 10`, `POINTS_PER_CALC = 10`, `HINT_AFTER_ERRORS = 2`, `REVEAL_AFTER_ERRORS = 3`, `MIXED = 'mix'`.
  - `createMentalSeries(className, family, seed) -> { seed, className, family, calcs }`.
    - RangeError si la graine est invalide, la classe inconnue, ou la famille absente de la classe (`MIXED` excepté).
    - Famille seule : les `min(SERIES_LENGTH, n)` premiers calculs, après mélange.
    - `MIXED` :
      - les familles de la classe, mélangées, sont prises à tour de rôle jusqu'à 10 calculs ;
      - dans chaque famille, on tire le prochain calcul de sa liste mélangée.
  - `maxDigits(series) -> number` : nombre de chiffres de la plus grande réponse de la série.
  - État :
    - `createMentalState(series) -> { phase: 'main' | 'retry' | 'done', position, retryIds, entries }` ;
    - `entries` : un objet par calcul et par phase, `{ calcId, phase, position, errors, found, revealed }`.
  - Fonctions sur l'état :
    - `currentCalc(series, state)` ;
    - `currentEntry(state) -> entry` (`errors: 0` si rien n'a encore été tenté) ;
    - `isResolved(entry)` : `found || revealed` ;
    - `showHint(entry)` : `errors >= 2` ;
    - `canReveal(entry)` : `errors >= 3` et non résolu ;
    - `submitAnswer(series, state, value: number) -> state`. Renvoie le même objet si le calcul est résolu ou la série finie. Juste : `found`. Faux : `errors + 1` ;
    - `revealAnswer(series, state) -> state`. Même objet si `!canReveal` ;
    - `nextCalc(series, state) -> state`. Même objet si non résolu. En fin de série principale, les calculs `revealed` passent en reprise (une fois, sans points), sinon `done`.
  - Comptes de la série principale : `mentalScore(state)` (= `foundCount × POINTS_PER_CALC`), `foundCount`, `revealedCount`, `errorCount`.
  - `calcHint(calc, language) -> string` : textes exacts du spec §6.4, avec les nombres du calcul. `table` : « Compte de a en a : a, 2a, 3a… », avec les trois nombres calculés (`Compte de 7 en 7 : 7, 14, 21…`). En anglais : `Count in 7s: 7, 14, 21…`.

- [ ] **Step 1 : écrire les tests** (`src/utils/mentalMath.test.js`).
  - Séries :
    - même graine, même série ; RangeError si la graine vaut `-1`, la classe `'X'`, ou pour `('SIL', 'G', 1)` ;
    - `('CE1', 'A', s)` : 10 calculs distincts, tous de la famille A ;
    - `('SIL', 'C', s)` : 9 calculs ;
    - `MIXED` sur 100 graines, pour CM1 et Class 1 : 10 calculs distincts, chaque famille de la classe présente.
  - `maxDigits` d'une série CM1 G ≥ 4.
  - Réponses :
    - juste du premier coup : score 10 ;
    - 3 erreurs, puis juste : score 10, `errorCount` 3 ;
    - `showHint` faux à 1 erreur, vrai à 2 ;
    - `canReveal` faux à 2 erreurs, vrai à 3 ;
    - `revealAnswer` à 2 erreurs : même objet ;
    - réponse vue : 0 point, `revealedCount` 1. Une saisie juste ensuite renvoie le même objet ;
    - fin de série avec 1 réponse vue : phase `retry`, un calcul. Trouvé en reprise : score inchangé. Puis `done` ;
    - `nextCalc` sur un calcul non résolu : même objet.
  - Indices :
    - `calcHint` de `table` 7 × 8 en `fr` : `'Compte de 7 en 7 : 7, 14, 21…'` ;
    - `complement` 6 vers 10 : `'Combien faut-il ajouter à 6 pour arriver à 10 ?'` ;
    - chaque type a un indice non vide en `fr` et en `en`, contrôlé sur un calcul de chaque famille des 12 classes.
- [ ] **Step 2 : lancer** `node --test src/utils/mentalMath.test.js`. Attendu : échec.
- [ ] **Step 3 : implémenter** dans `mentalMath.js`.
- [ ] **Step 4 : lancer** les tests des tâches 1 et 2, puis `npm test` (attendu : 0 échec) et `npm run lint`.
- [ ] **Step 5 : commit** « Ajoute les séries, les réponses et les indices du calcul mental ».

### Task 3 : Page, carte et tests de bout en bout

**Files :**
- Create : `src/pages/MentalMathGame.jsx`, `src/styles/MentalMathGame.css`, `e2e/calcul-mental.spec.js`
- Modify :
  - `src/App.jsx` : `'mentalMathGame'` dans `STUDENT_PAGES`, rendu sans vocabulaire ;
  - `src/pages/StudentDashboard.jsx` : carte `{ id: 'mentalMath', name: fr ? 'Calcul mental' : 'Mental maths', icon: '🧮', available: true, page: 'mentalMathGame' }`, après « Nombres croisés » ;
  - `PROJECT_STATUS.md`.

**Interfaces :**
- Consumes :
  - tâches 1 et 2 ;
  - `resolveMathClass({ level, className, subsystem })` de `reglages-maths.js`, et le message de classe par défaut repris de `CrossNumberGame.jsx` (l. 283-290) ;
  - `NumberPad` (`onDigit`, `onDelete`, `onValidate`, `validateDisabled`, `language`) ;
  - `saveScore`, `saveUserProgress` ;
  - `newSeed` de `pairsGame.js`.

- [ ] **Step 1 : écrire `e2e/calcul-mental.spec.js`.**
  - Helpers : taper un nombre au pavé, avec les touches de `NumberPad` (lire leurs noms accessibles dans le composant), puis valider.
  - La série attendue est recalculée avec `createMentalSeries`.
  - Tests :
    1. **Série CE1, mélange, toutes justes.**
       - Ligne « Réglé pour : CE1 (francophone) » ;
       - mention « Démonstration » ;
       - « Calcul i / 10 » ;
       - score 100 ;
       - un seul `saveScore` (`gameType: 'mentalMath'`, `className: 'CE1'`, `family: 'mix'`, `calcCount: 10`, `foundCount: 10`).
    2. **Erreurs et aides.**
       - Deux mauvaises réponses : « Ce n'est pas ça. Essaie encore. », puis l'indice exact (`calcHint`) ;
       - troisième erreur : bouton « Voir la réponse » ; après le toucher, la réponse s'affiche (`7 × 8 = 56`) ;
       - le reste de la série juste, puis la reprise : « On revoit les calculs » ;
       - score 90.
    3. **Élève de SIL.** Calculs sans lettres, et boutons de famille A, B, C, F, « Mélange de la classe ».
    4. **Élève anglophone (Class 4, interface en anglais).** « Set for: Class 4 (English-speaking) » ; une série complète ; calculs en anglais (« Double of », « Half of »).
    5. **Profil sans classe (CE1-CE2).** Message de classe par défaut, comme les nombres croisés ; le jeu fonctionne.
    6. **Double toucher sur « Suivant ».** Le calcul suivant reste sans saisie, ni message.
    7. **375 et 320 px.** Pas de débordement sur une série CM2 G (grands nombres) ; touches du pavé ≥ 44 px.
- [ ] **Step 2 : lancer** `npx playwright test e2e/calcul-mental.spec.js --project=ordinateur`. Attendu : échecs (carte absente).
- [ ] **Step 3 : implémenter la page.**
  - Écran de choix :
    - classe résolue et message de classe par défaut ;
    - boutons des familles (`familyName`) et « Mélange de la classe » / « Class mix », par défaut ;
    - numéro de partie, et le texte : « Démonstration : calculs générés, réglages à valider par un enseignant. » / « Demo: generated sums, settings to be checked by a teacher. »
  - Écran de jeu :
    - le calcul en grand et la saisie affichée (`formatNumber`) ;
    - saisie limitée à `maxDigits(series)` chiffres ; ✓ désactivé si la saisie est vide ;
    - messages : « Bravo ! » / « Well done! » ; « Ce n'est pas ça. Essaie encore. » / « Not quite. Try again. » ;
    - l'indice (`calcHint`) ;
    - « Voir la réponse » / « Show the answer », puis l'énoncé complété (`7 × 8 = 56` ; pour `7 × ? = 56` aussi `7 × 8 = 56` ; pour `Moitié de 18` : `Moitié de 18 = 9`) ;
    - « Suivant » toujours affiché, désactivé tant que le calcul n'est pas résolu ;
    - délai de 500 ms après « Suivant » ; ref contre le double toucher ; un `saveUserProgress` par calcul résolu en série principale ;
    - un seul `saveScore`, avec les détails du spec §6.3.
  - Fin : score ; « Sur N calculs : X trouvés, Y réponses vues. » ; liste des calculs complétés ; « Nouvelle partie », « Retour ».
- [ ] **Step 4 : brancher** `App.jsx`, la carte et `PROJECT_STATUS.md`. Lancer :
  - `npx playwright test e2e/calcul-mental.spec.js` : PASS sur les 3 projets ;
  - `npm run lint` ;
  - `npm run build` : bundle < 500 KB gzip.
- [ ] **Step 5 : commit** « Ajoute la page et la carte du calcul mental ».

## Fin

- Relecture de toute la branche par un relecteur neuf, avec la section Review Focus ; corrections Critical et Important, chacune avec un test vu en échec.
- Régression complète : `npm test`, `npm run lint`, `npm run build`, `npx playwright test`.
- Proposer la pull request à Isaac.
