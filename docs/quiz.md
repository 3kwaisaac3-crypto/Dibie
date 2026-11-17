# Quiz (moteur D) : note de conception du lot A

**Statut** : conception validée par Isaac le 2026-11-17 (« Écris ainsi ») ; choix C1 à C5 provisoires, à valider par Isaac après essai, puis par un enseignant.
**Branche** : `feature/quiz-moteur-d`.
**Références** : `catalogue-jeux-v0.2.md` §0.4 (moteur D), fiche L8 ; `docs/plan-migration.md` §4 (phase 7) et §5.2 ; `docs/paires.md` §13 à §18 (L4, dont ce lot réutilise les règles).

## 1. Intention

La phase 7 du plan ajoute le **moteur D, « Choix »** : choisir une réponse parmi des propositions. Le catalogue le prévoit pour trois jeux : le quiz (L8), l'intrus (L9) et les relations entre les mots (L14). Le lot A construit le moteur et un premier jeu jouable sans contenu nouveau : le **quiz « définition → mot »**, alimenté par `vocabulaire.json`.

Objectif observable (fiche L8) : l'élève choisit la bonne réponse à une question précise. Compétence : connaissance du vocabulaire (reconnaître un mot à sa définition).

## 2. Périmètre

**Dans le lot A** :
- moteur générique de choix (questions, propositions, réponse, score, reprise des questions ratées), indépendant du contenu ;
- fabrication des questions « définition → mot » à partir du vocabulaire ;
- page du jeu, carte du tableau de bord, enregistrement du score ;
- tests unitaires et de bout en bout.

**Hors du lot A** (lots suivants) :
- **L'intrus (L9)** : il exige un contenu rédigé et vérifié (catalogue L9 et §4), qui n'existe pas ; son format sera défini avec lui.
- **Le calcul mental (M6)** : il n'utilise pas le moteur D (pavé numérique, génération automatique) ; décision D5 (chronomètre désactivé par défaut) à appliquer à ce moment.
- **Les questions « traduction »** et les quiz d'autres disciplines (contenu rédigé, à vérifier par le researcher).
- **La mise en commun des règles des définitions** dans un module partagé (voir §4, approche 3).

**À éviter** (ce qui ferait échouer le lot même s'il fonctionne) :
- une question avec **deux bonnes réponses** parmi les propositions détectables par les règles existantes ;
- un sujet affiché jouable qui ne donne pas une série complète pour un numéro donné ;
- un changement des parties existantes (L3, L4, L6, anagrammes, mystères) ou de leurs tests de référence.

## 3. Contraintes du projet

- Hors ligne : tout est calculé dans le navigateur à partir de `vocabulaire.json` ; aucun appel réseau.
- Logique dans `src/utils/`, fonctions pures et testées avec `node --test` ; composants fonctionnels avec hooks.
- Aucun nombre magique : réglages en constantes nommées.
- Même graine, même quiz (`createRandom`, `newSeed`, `isValidSeed`, comme les autres jeux).
- Interface en français et en anglais ; messages de commit en français, à l'impératif.

## 4. Approches envisagées

| # | Approche | Ce qu'elle apporte | Ce qu'elle coûte | Décision |
|---|---|---|---|---|
| 1 | **Moteur générique `choiceGames.js` + adaptateur vocabulaire** qui réutilise `definitionCandidates` de `pairsGame.js` | Moteur réutilisable par l'intrus et L14 ; toutes les règles de L4 contre la deuxième bonne réponse, sans recopie | Le quiz dépend d'un module nommé « paires » | **Retenue** |
| 2 | Copier `DefinitionGame.jsx` et remplacer les paires par des questions | Le plus rapide | Pas de moteur réutilisable : contraire au but de la phase | Écartée |
| 3 | Sortir d'abord les règles des définitions de `pairsGame.js` dans un module partagé | Plus propre | Touche au lot C ; risque de changer des parties de référence | Reportée (possible plus tard, sans changer le comportement) |

## 5. Moteur D : `src/utils/choiceGames.js`

Fonctions pures, sans connaissance du vocabulaire. Une **question** est :

```js
{ id, prompt, options: [{ id, text }], answerId, feedback }
```

- `prompt` : texte de la question (ici la définition) ;
- `options` : propositions dans l'ordre d'affichage (une seule a l'id `answerId`) ;
- `feedback` : données affichées après la réponse (ici le mot et sa définition).

Le moteur fournit :
- l'**état d'une série** : question en cours, réponses données, phase (série principale ou reprise) ;
- `answer(state, optionId)` : enregistre la réponse (un seul essai par question, C3) ;
- le passage à la question suivante ; à la fin de la série principale, les **questions ratées reviennent une fois**, dans le même ordre, avec leurs propositions remélangées selon la graine ; les réponses de la reprise ne rapportent pas de points ;
- `isFinished`, `correctCount` (premier essai seulement), `quizScore` (10 points par bonne réponse du premier coup, C4).

Le mélange de l'ordre des propositions utilise la graine de la partie ; si l'ordre mélangé place la bonne réponse toujours au même rang dans toute la série, ce n'est pas corrigé (tirage aléatoire honnête) — **choix laissé au developer** s'il souhaite équilibrer les rangs.

## 6. Questions « définition → mot »

### 6.1 Candidats

`definitionCandidates(entries, language)` (déjà dans `pairsGame.js`) donne, pour les entrées d'un sujet et d'un niveau, les candidats utilisables avec leurs **clés d'exclusion** :
- entrée inactive, mot ou définition vide : écartée ;
- définition qui donne son propre mot (toutes les formes « A / B ») : écartée ;
- clés « w: » : toutes les formes FR et EN (synonymes jamais ensemble) ;
- clé « d: » : la définition affichée ;
- clés « m: » (règle §6.2) : la définition de A cite le mot de B.

Deux candidats qui partagent une clé sont « en conflit ».

### 6.2 Règles de tirage

1. **Propositions d'une question** : la bonne réponse et des mauvaises réponses du **même niveau et du même sujet**, toutes **sans conflit** entre elles ni avec la bonne réponse. Aucune proposition n'est donc un synonyme connu, un mot cité par la définition, ni un mot de même définition.
2. **Questions de la série** : des bonnes réponses toutes différentes, aux **définitions toutes différentes** (clé « d: ») ; deux questions peuvent avoir des réponses synonymes (chacune est exclue des propositions de l'autre par la règle 1).
3. **Garantie** : un sujet est jouable seulement si la série est complète **pour toute graine** (borne sûre, comme `guaranteedPairCount`) : assez de candidats aux définitions distinctes pour le nombre de questions, et assez de groupes sans conflit pour le nombre de propositions (des candidats de groupes différents ne sont jamais en conflit). L'algorithme exact est laissé au developer, avec cette garantie testée sur de longues séries de graines.
4. Tri préalable par id avant le tirage : le résultat ne dépend que du contenu et de la graine.

### 6.3 Langue

Langue de l'interface au lancement : `mot_fr` / `def_fr` ou `mot_en` / `def_en` (comme L4). Un même numéro peut donner des quiz différents en français et en anglais ; les sujets grisés dépendent de la langue.

## 7. Choix provisoires (à valider par Isaac, puis par un enseignant)

| # | Choix | Détail |
|---|---|---|
| C1 | Niveaux et propositions | Pas de SIL-CP (lecture de phrases) : la carte est visible, la page s'ouvre en CE1-CE2 avec le message de L4 (« Ce jeu commence au CE1-CE2 : il faut lire des phrases. Tu peux essayer avec un adulte. ») ; **3 propositions en CE1-CE2, 4 en CM1-CM2** (hypothèse de la fiche L8) |
| C2 | Longueur de série | **6 questions en CE1-CE2, 8 en CM1-CM2** (fiche L8 : 5 à 10) ; sujet grisé (« pas assez de mots ») si la série n'est pas garantie |
| C3 | Réponse | **Un seul essai** ; bonne réponse : « Bravo ! » ; mauvaise réponse : la proposition choisie est marquée fausse, la bonne réponse est montrée avec sa définition (« MOT : définition »), puis bouton « Suivant » ; questions ratées reproposées une fois en fin de série (fiche L8, `educator.md` §28) |
| C4 | Score et enregistrement | 10 points par bonne réponse du **premier** essai ; pas d'étoiles ni de badge ; `gameType` = `quizDefinition` ; `saveScore` une seule fois à la fin de la série (reprise comprise), détails `{ seed, language, subject, questionCount, correctCount }` |
| C5 | Affichage | La définition sert de question (casse normale) ; les propositions sont des boutons en **majuscules** (`displayText`), dans un ordre fixé par le numéro ; cibles d'au moins 44 px, utilisable à 320 px de large |

Choix de l'écran repris de L4 sans nouvelle décision : niveau, puis matière, puis sujet ; numéro de partie affiché et modifiable comme dans les autres jeux ; retour au tableau de bord depuis l'écran de choix et l'écran de fin ; écran de fin avec score et récapitulatif.

## 8. Fichiers

| Fichier | Action |
|---|---|
| `src/utils/choiceGames.js` | Créer : moteur D et questions « définition → mot » |
| `src/utils/choiceGames.test.js` | Créer |
| `src/pages/QuizGame.jsx` | Créer |
| `src/styles/QuizGame.css` | Créer |
| `e2e/quiz.spec.js` | Créer |
| `src/App.jsx` | Modifier : page `quizGame` (pages élève, chargement du vocabulaire) |
| `src/pages/StudentDashboard.jsx` | Modifier : une carte |
| `PROJECT_STATUS.md` | Modifier : ligne du lot A |

`src/utils/pairsGame.js` n'est **pas modifié** (import de `definitionCandidates`, `displayText` et des fonctions de graine).

## 9. Tests attendus

Unitaires (`node --test`) :
- aucun mot inactif proposé ;
- une seule bonne réponse par question ; aucune proposition en conflit avec une autre (clés) ;
- mauvaises réponses du même sujet et du même niveau ;
- aucune définition contenant sa réponse ;
- même graine, même quiz ; graine invalide refusée ;
- définitions toutes différentes dans une série ;
- tout sujet déclaré jouable donne une série complète sur une longue suite de graines, en français et en anglais, aux deux niveaux ;
- moteur : un seul essai, score au premier essai seulement, reprise des questions ratées une fois, fin de série.

Bout en bout (Playwright) : partie complète en CE1-CE2 et en CM1-CM2 ; message SIL-CP ; reprise d'une question ratée ; affichage à 375 et 320 px sans débordement.

Non-régression : `npm test` complet (dont les tests de référence des anagrammes et des mystères) et `npm run lint` sans changement des résultats existants.

## 10. Limites connues

- **Deux bonnes réponses non détectées** : comme en L4 (`docs/paires.md` §18), une définition qui **convient** à un autre mot sans le citer (SOMME / TOTAL, ÉTAL / ÉTALAGE, AVENUE / BOULEVARD…) n'est pas repérée. En quiz, l'élève qui choisit l'autre mot perd un point alors qu'il a raison. Remède possible plus tard : liste manuelle de paires à ne jamais proposer ensemble, ou passe de contenu.
- Pas d'explication rédigée : le retour montre la définition, pas une explication pédagogique.
- Aucun essai sur un vrai téléphone ; nombre de propositions et longueur des séries à valider par un enseignant.
