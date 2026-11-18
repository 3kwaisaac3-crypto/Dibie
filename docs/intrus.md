# L'intrus (L9, moteur D) : note de conception du lot C

**Statut** : conception validée par Isaac le 2026-11-17 (« Écris, ainsi ») ; choix I1 à I10 (§7) à valider par Isaac, puis par un enseignant.
**Branche** : `feature/intrus-moteur-d`.
**Références** : fiche L9 de `catalogue-jeux-v0.2.md` ; cadrage de la phase 7 (`cadrage-phase7-quiz-intrus-calcul-mental-v0.1.md`, §3.2, P6, P7, P10, P12) ; contenu `DIBIE/contenus/intrus-lot0-v0.1.md` (60 items, BROUILLON) ; `docs/quiz.md` (moteur D, lot A).

## 1. Intention

Deuxième jeu du moteur D. L'élève voit 4 mots et touche celui qui n'appartient pas au groupe ; au CM1-CM2, il dit aussi pourquoi, en choisissant la raison parmi 3. Compétence : classer, justifier (« la justification compte autant que l'intrus », fiche L9).

Le contenu est **rédigé à la main** (jamais généré depuis le champ `sujet`, fiche L9). Seuls les items validés sont montrés aux élèves (P6, décision d'Isaac du 2026-11-09, même règle que les Grilles du maître).

## 2. Périmètre

**Dans le lot C** :
- fichier de données `src/data/intrus.json` : les 60 items du lot 0, en français et en anglais, avec leur statut ;
- un premier jet des **2 raisons fausses** de chaque item du CM1-CM2 (30 items), au statut BROUILLON comme le reste de l'item ;
- préparation des questions pour le moteur D, page du jeu, carte du tableau de bord, enregistrement du score ;
- une **fiche imprimable** des 60 items pour la validation par Isaac (garder / modifier / écarter), comme la fiche des choix C1 à C8 du quiz ;
- tests unitaires et de bout en bout.

**Hors du lot C** : nouveaux items ; matières absentes (histoire, civisme, arts) ; audio pour les critères de son (D6) ; variante SIL-CP (images, D7) ; changement du moteur `choiceGames.js`.

**À éviter** (échec même si le jeu fonctionne) :
- montrer à un élève un item qui n'est pas au statut « VALIDÉE PAR ISAAC », VALIDÉ ou PUBLIÉ ;
- un item mal formé (deux fois le même mot, intrus absent des mots, raison vide) qui arrive à l'écran ;
- un changement de comportement du quiz ou de ses tests.

## 3. Contraintes du projet

Les mêmes que le quiz (`docs/quiz.md` §3) : hors ligne, données embarquées, logique pure dans `src/utils/` testée avec `node --test`, aucun nombre magique, même graine même partie, interface FR / EN.

## 4. Approches envisagées

| # | Approche | Ce qu'elle apporte | Ce qu'elle coûte | Décision |
|---|---|---|---|---|
| 1 | **Deux questions à la suite dans le moteur existant** : pour un item du CM, « Trouve l'intrus » puis « Pourquoi ? » | `choiceGames.js` inchangé, le quiz ne risque rien ; les règles validées du quiz (deux essais, 10 / 5 points, reprise) s'appliquent d'office ; 10 points pour l'intrus et 10 pour la raison (P12) | Si l'intrus est raté, la question « pourquoi ? » est posée quand même, alors que la réponse a été montrée (choix I6) | **Retenue par Isaac le 2026-11-17** |
| 2 | Un item en deux étapes, ajouté au moteur | Permettrait de sauter le « pourquoi ? » après un intrus raté | Touche le code du quiz, validé sur téléphone ; plus de tests | Écartée |

Pour l'accès au contenu, une seule voie raisonnable : un fichier JSON embarqué (comme `grilles-maitre.json`), vérifié par un test. Le filtre de statut réutilise `isVisibleStatus` de `src/utils/grillesMaitrePlay.js`, sans recopie.

## 5. Données : `src/data/intrus.json`

```json
{
  "format": "dibie-intrus",
  "version": 1,
  "source": "DIBIE/contenus/intrus-lot0-v0.1.md (JARVIS, 2026-11-11)",
  "items": [
    {
      "id": "I-CE-01",
      "niveau": "CE1-CE2",
      "matiere": "Vie quotidienne (aliments)",
      "critere": "Catégorie de sens",
      "statut": "BROUILLON",
      "reserve": "",
      "fr": {
        "consigne": "Trouve ce qui n'est pas un fruit.",
        "elements": ["BANANE", "MANGUE", "CAROTTE", "PAPAYE"],
        "intrus": "CAROTTE",
        "raison": "Les trois autres sont des fruits. La carotte est un légume."
      },
      "en": { "consigne": "Find the one that is not a fruit.", "elements": ["banana", "mango", "carrot", "papaya"], "intrus": "carrot", "raison": "..." }
    }
  ]
}
```

- CE1-CE2 : `consigne` obligatoire, pas de `raisonsFausses`.
- CM1-CM2 : pas de `consigne` (consigne unique « Trouve l'intrus » / « Find the odd one out ») ; `raisonsFausses` : 2 phrases par langue.
- `statut` : l'une des valeurs de `MASTER_GRID_STATUSES` (BROUILLON → À VÉRIFIER → VALIDÉE PAR ISAAC → VALIDÉ → PUBLIÉ). Seul Isaac fait passer un item à « VALIDÉE PAR ISAAC » ; le developer reporte sa décision dans le fichier.
- `reserve` : texte de la colonne « Réserve » du lot 0, gardé pour la fiche de validation (non affiché aux élèves).
- Le fichier est la source pour l'application ; il est créé une fois à partir du tableau du lot 0 (conversion faite par le developer, relue sur la fiche imprimable). L'ordre des `elements` dans le fichier n'a pas d'importance : l'application les mélange.
- Mots affichés en majuscules dans les deux langues, comme les propositions du quiz (C5) ; le fichier garde la casse du lot 0.

## 6. Questions pour le moteur D : `src/utils/intrusGame.js`

`createIntrusGame(collection, level, seed, language)` renvoie `{ seed, level, language, questions }`, ou `null` s'il n'y a aucun item visible pour ce niveau.

1. Items retenus : niveau demandé, statut visible (`isVisibleStatus`), item bien formé dans la langue demandée.
2. Tirage : items triés par `id`, mélangés selon la graine ; on en prend `ITEMS_PER_GAME[level]` (I2), ou tous s'il y en a moins.
3. Questions :
   - **CE1-CE2**, une question par item : `prompt` = consigne ; propositions = les 4 mots mélangés ; `feedback` = la raison.
   - **CM1-CM2**, deux questions par item, à la suite :
     - « Trouve l'intrus » : les 4 mots mélangés ; `feedback` : l'intrus (sans la raison, qui est la question suivante) ;
     - « Pourquoi X est-il l'intrus ? » (X = l'intrus, écrit dans la question, pour que la question reste juste même après un intrus raté) : la raison juste et les 2 raisons fausses, mélangées ; `feedback` = la raison.
   - `retryOptions` : ordre remélangé, différent du premier (même règle que le quiz, `docs/quiz.md` §6.2).
4. Identifiants : propositions `${item.id}:${index}` ; questions `${item.id}` (CE, et intrus au CM) et `${item.id}:pourquoi`.

Le moteur `choiceGames.js` gère la suite : deux essais, points, reprise des ratées. Les fonctions de mélange viennent des modules existants (`createRandom`, `shuffled`, `isValidSeed`).

Enregistrement, comme le quiz (C4) : `saveScore` une fois en fin de partie, `gameType` = `intrus`, détails `{ seed, language, itemCount, questionCount, correctCount, firstTryCount, secondTryCount }` ; `saveUserProgress` une fois par question résolue en série principale.

`intrusSummary(collection)` (pour la fiche de validation et les tests) : nombre d'items par niveau et par statut.

## 7. Choix à valider (I1 à I10)

| # | Choix | Proposition |
|---|---|---|
| I1 | Niveaux | CE1-CE2 et CM1-CM2 ; pas de SIL-CP (lecture de phrases, D7) : carte visible, la page s'ouvre en CE1-CE2 avec le message du quiz (C1) |
| I2 | Longueur d'une partie | **6 items** aux deux niveaux (6 questions en CE1-CE2, 12 au CM1-CM2) ; moins s'il y a moins d'items validés ; message « Pas encore d'intrus validés pour ce niveau » s'il n'y en a aucun |
| I3 | Écran de choix | Niveau et numéro de partie seulement (pas de matière ni de sujet : 30 items par niveau, mélangés) |
| I4 | CE1-CE2 | La consigne donne le critère ; la raison est affichée après la réponse, juste ou fausse (P7 a) ; pas de question sur la raison |
| I5 | CM1-CM2 | « Trouve l'intrus », puis « Pourquoi X est-il l'intrus ? », 3 raisons (P7 a) |
| I6 | Intrus raté au CM | La question « pourquoi ? » est posée quand même (approche 1) ; elle rapporte ses points normalement |
| I7 | Essais et points | Règle du quiz (C3, C4) : deux essais, 10 points au premier, 5 au second, 0 après deux erreurs ; ratées reprises une fois, sans points ; au CM, jusqu'à 20 points par item |
| I8 | Langue | Langue de l'interface au lancement ; items à mots anglais dans la version FR (I-CE-26, I-CM-27, I-CM-28) gardés tels quels |
| I9 | Nom de la carte | « L'intrus » / « Odd one out » (P12) |
| I10 | Raisons fausses | Premier jet rédigé dans ce lot (BROUILLON) ; une raison fausse doit être fausse pour l'intrus, mais plausible (pas absurde), et courte |

## 8. Validation du contenu

1. Le developer convertit les 60 items et rédige les 60 raisons fausses (30 items × 2), dans les deux langues ; tout reste BROUILLON.
2. Fiche imprimable (`DIBIE/pedagogie/intrus-validation-lot-c.pdf`, hors du dépôt), produite depuis `src/data/intrus.json` : pour chaque item, les mots (intrus en gras), la consigne ou les raisons, la réserve, et les cases « Garder / Modifier / Écarter ».
3. Isaac remplit la fiche ; le developer passe les items gardés à « VALIDÉE PAR ISAAC », applique les modifications demandées, et laisse les écartés en BROUILLON (ils restent dans le fichier, jamais montrés).
4. La fusion de la branche attend cette validation : sans elle, le jeu s'ouvre vide.

## 9. Fichiers

- Nouveaux : `src/data/intrus.json`, `src/utils/intrusGame.js` et `intrusGame.test.js`, `src/pages/IntrusGame.jsx`, `src/styles/IntrusGame.css` (peut s'appuyer sur les classes de `QuizGame.css`), `e2e/intrus.spec.js`, `docs/intrus.md`.
- Modifiés : `src/App.jsx` (page `intrusGame`), `src/pages/StudentDashboard.jsx` (carte), `PROJECT_STATUS.md`.
- Inchangés : `src/utils/choiceGames.js`, `src/utils/grillesMaitrePlay.js` (seulement importé).

## 10. Tests attendus

- **Données** (sur tout le fichier) : `id` uniques ; 30 items par niveau ; statut connu ; dans chaque langue, 4 mots non vides et distincts, intrus présent une seule fois parmi eux, raison non vide ; consigne présente en CE1-CE2 ; au CM1-CM2, 2 raisons fausses non vides, distinctes entre elles et de la raison juste.
- **Préparation** (avec un petit jeu d'essai) : items non validés jamais présents ; même graine, même partie ; graine invalide refusée ; CE : une question par item ; CM : deux questions par item, dans l'ordre intrus puis pourquoi, l'intrus nommé dans la seconde ; ordre de reprise toujours différent ; moins d'items validés que `ITEMS_PER_GAME` : partie plus courte ; aucun : `null`.
- **De bout en bout** : élève SIL-CP (message) ; aucun item validé (message, testé tant qu'un niveau n'a aucun item validé) ; partie complète CE1-CE2 et CM1-CM2 avec un raté repris ; double toucher ; anglais ; 375 et 320 px. Les parties complètes ont besoin d'items validés : le test lit `intrus.json` et se met en attente (`test.skip`, avec la raison) tant qu'il n'y a pas assez d'items validés pour le niveau ; il est rejoué avant la fusion, une fois la validation d'Isaac reportée.

## 11. Ce qui reste au developer

- Formulation exacte des messages et des retours, sur le modèle du quiz.
- Mise en page, à partir de `QuizGame.css`.
- Forme de la fiche imprimable.
