# Calcul mental (M6) : note de conception du lot B

**Statut** : conception validée par Isaac le 2026-11-17 (« écris ainsi ») ; choix M1 à M10 (§8) à valider par Isaac, puis par un enseignant de chaque sous-système.
**Branche** : `feature/calcul-mental-m6`.
**Références** : fiche M6 de `catalogue-jeux-v0.2.md` ; cadrage de la phase 7 (`cadrage-phase7-quiz-intrus-calcul-mental-v0.1.md`, §3.3, P8 à P11) ; **`DIBIE/pedagogie/calcul-mental-familles-lot0-v0.1.md` (V0.3)**, familles et bornes par classe, 12 questions tranchées par Isaac le 2026-11-12 ; `src/data/reglages-maths.js`.

## 1. Intention

L'élève fait une série de calculs de tête et tape chaque réponse sur le pavé de chiffres. Il travaille les automatismes de sa classe : additions, soustractions, compléments, doubles et moitiés, tables, produits par 10, 100, 1 000, et facteur manquant au CM. Le jeu suit la classe du profil (SIL à CM2, Class 1 à Class 6), comme les pyramides et les nombres croisés.

Tout est généré : les bornes sont des **propositions sans source, provisoires** (choix 1a du 2026-11-12). Le jeu est jouable et marqué « démonstration » (P6). Il n'est pas présenté comme une préparation au CEP ou au FSLC.

## 2. Périmètre

**Dans le lot B** :
- fichier de réglages `src/data/calcul-mental.js` : les familles et les bornes de chaque classe, recopiées du document du lot 0 (§2) ;
- module pur `src/utils/mentalMath.js` : tirage des séries et suivi des réponses ;
- indices par forme de calcul (§6), rédigés dans ce lot, marqués « à valider » ;
- page, carte du tableau de bord, enregistrement du score ;
- tests unitaires et de bout en bout.

**Hors du lot B** : chronomètre ou mode « défi » (P11 : lot D) ; division par un nombre de la table (choix 8a) ; produits par 10, 100, 1 000 en anglophone (choix 7a) ; × 0,5 et autres calculs à virgule ; audio.

**À éviter** (échec même si le jeu fonctionne) :
- un calcul hors des règles communes (§4) : résultat négatif, décimal, division non exacte, + 0, × 1, deux fois le même calcul dans une série ;
- un calcul hors des bornes de la classe, ou une famille proposée à une classe qui ne l'a pas (§3) ;
- un mot dans un calcul de SIL ou de Class 1 (choix 5b) ;
- une modification de `reglages-maths.js` ou des jeux qui l'utilisent.

## 3. Familles par classe

Recopiées de la vue d'ensemble du lot 0 (§2.3). Les formes et les bornes exactes de chaque case sont dans les tableaux §2.1 et §2.2 du lot 0, **à recopier telles quelles**.

| Classe | A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|---|
| SIL | x | x | x | | | x (×2) | | | |
| CP | x | x | x | x | | x | | | |
| CE1 | x | x | x | x | x (triple, tiers) | x | | | |
| CE2 | x | x | x | x | x (quadruple, quart) | x | x | | |
| CM1 | x | x | x | x | | x | x | x | x |
| CM2 | x | x | x | x | | x | x | x | x |
| Class 1 | x | x | x | | | | | | |
| Class 2 | x | x | x | x | | | | | |
| Class 3 | x | x | x | x | | x (fragile) | | | |
| Class 4 | x | x | x | x | | x (fragile) | | | |
| Class 5 | x | x | x | x | | x | | | x |
| Class 6 | x | x | x | x | | x | | | x |

Familles : A additions ; B soustractions ; C compléments ; D doubles et moitiés ; E triple et tiers, quadruple et quart ; F tables ; G produits et quotients par 10, 100, 1 000 ; H produits particuliers (× 5, × 50, × 500, × 11, × 12, × 25) ; I facteur manquant.

## 4. Règles communes (lot 0 §1, cadrage §4 règle 5)

- Opérandes et résultats entiers positifs ; pas de résultat négatif ; divisions exactes ; pas de virgule.
- Soustraction : second terme strictement plus petit (résultat ≥ 1).
- Tables : multiplicateur de 2 à 10 ; × 0 et × 1 écartés (choix 4a : pas de table × 1 en SIL).
- Pas deux fois le même calcul dans une série (même texte affiché).
- En SIL et Class 1 : uniquement des chiffres et des signes (pas de famille D ; le double est un cas de A, a = b permis).
- `maxNumber` de `reglages-maths.js` : plafond jamais dépassé (vérifié par un test), pas une borne de calcul.

## 5. Approches envisagées

| # | Approche | Ce qu'elle apporte | Ce qu'elle coûte | Décision |
|---|---|---|---|---|
| 1 | **Nouveau module `mentalMath.js` + réglages `calcul-mental.js`**, pavé `NumberPad` réutilisé | Bornes propres au calcul mental (P8) ; aucun jeu existant touché | Une table de réglages de plus à tenir | **Retenue par Isaac le 2026-11-17** |
| 2 | Réutiliser les définitions des nombres croisés (`crossNumberDefinitions.js`) | Code déjà testé pour double, moitié… | Bornes des grilles, pas celles décidées en P8 ; ni complément, ni facteur manquant, ni produits particuliers ; toucherait un jeu fini | Écartée |
| 3 | Moteur D (quiz) | Écran déjà fait | Choix parmi des propositions, pas une saisie ; règles d'essais différentes de P10 | Écartée |

## 6. Conception

### 6.1 Réglages : `src/data/calcul-mental.js`

Pour chaque classe (`className` de `reglages-maths.js`), la liste de ses familles ; chaque famille a une ou plusieurs **formes**, chacune avec ses bornes. Une forme est un type parmi une liste fermée, par exemple :

| Type | Affichage FR / EN | Exemple |
|---|---|---|
| `add` | `a + b = ?` | 8 + 7 = ? |
| `sub` | `a − b = ?` | 16 − 7 = ? |
| `complement` | `a + ? = n` (n fixe, n = dizaine qui suit a, ou n dans un intervalle) | 37 + ? = 40 |
| `double`, `half` | `Double de a` / `Double of a` ; `Moitié de a` / `Half of a` | Moitié de 18 |
| `triple`, `third`, `quadruple`, `quarter` | `Triple de a`, `Tiers de a`, `Quadruple de a`, `Quart de a` | Tiers de 24 |
| `table` | `a × b = ?` (a parmi les tables de la forme) | 4 × 6 = ? |
| `timesPow10`, `divPow10` | `a × 100 = ?`, `a ÷ 10 = ?` | 4 500 ÷ 100 = ? |
| `timesK` | `a × k = ?`, k parmi 5, 50, 500, 11, 12, 25 selon la forme | 14 × 25 = ? |
| `missingFactor` | `a × ? = c` | 7 × ? = 56 |

Le developer fixe la forme exacte des bornes (intervalles, pas, plafond du résultat) pour qu'elles reprennent mot pour mot chaque case des tableaux du lot 0. Un commentaire en tête du fichier cite le lot 0 et dit : PROVISOIRE, SANS SOURCE, à valider par un enseignant (D4).

### 6.2 Séries : `src/utils/mentalMath.js`

- **Énumération puis tirage** : pour une famille, on énumère tous les calculs distincts permis par ses formes (les familles sont petites ; la plus grande, G au CM, compte quelques milliers de calculs), puis on mélange selon la graine (`createRandom`) et on prend les premiers. Cela garantit l'absence de répétition et donne directement le nombre de calculs possibles.
- **Série d'une famille** : `SERIES_LENGTH = 10` calculs ; si la famille en compte moins (SIL : C et F, 9 chacune), la série prend tous ses calculs (choix 3a).
- **Mélange de la classe** : 10 calculs, les familles tirées à tour de rôle dans un ordre mélangé (chaque famille de la classe apparaît au moins une fois quand elle a moins de 10 familles), sans répétition.
- Même numéro + même classe + même choix de famille = même série (la langue ne change que l'affichage).
- Grands nombres : chiffres groupés par trois avec une espace (« 4 500 ») en français, avec une virgule (« 4,500 ») en anglais (relecture enseignant du 25/11/2026 (docs/retours-enseignants-2026-11.md)).

### 6.3 Réponses et points (P10)

- L'élève tape sa réponse au pavé (`NumberPad`) et valide.
- **Juste** : 10 points, même après une ou plusieurs erreurs (convention des phases 4 et 5, P10).
- **Fausse** : la saisie est effacée, message « Ce n'est pas ça. Essaie encore. ».
- **Après 2 erreurs** : l'indice de la forme s'affiche (§6.4), l'élève continue d'essayer.
- **Après 3 erreurs** : un bouton « Voir la réponse » apparaît ; s'il le touche, la réponse s'affiche (« 7 × 8 = 56 ») et le calcul vaut 0 point. Il peut aussi continuer d'essayer.
- Bouton « Suivant » une fois le calcul trouvé ou la réponse vue.
- **Reprise** (choix M6) : les calculs dont la réponse a été vue reviennent une fois en fin de série, sans points.
- Enregistrement : `saveScore` une fois en fin de série, `gameType` = `mentalMath`, détails `{ seed, className, subsystem, family, calcCount, foundCount, revealedCount, errorCount }` ; `saveUserProgress` une fois par calcul de la série principale.
- Délai de 500 ms après « Suivant » contre le double toucher, comme le quiz (C6).

### 6.4 Indices (premier jet, à valider par un enseignant)

Un indice par type de forme, avec les nombres du calcul. Ils aident à raisonner sans donner la réponse.

| Type | Indice FR | Indice EN |
|---|---|---|
| `add` | Pars du plus grand nombre et avance de b. | Start from the bigger number and count on b. |
| `sub` | Pars de a et recule de b. | Start from a and count back b. |
| `complement` | Combien faut-il ajouter à a pour arriver à n ? | How much do you add to a to make n? |
| `double` | Le double de a, c'est a + a. | Double a means a + a. |
| `half` | Cherche le nombre qui, ajouté à lui-même, donne a. | Find the number that, added to itself, makes a. |
| `triple` | Le triple de a, c'est a + a + a. | Triple a means a + a + a. |
| `third` | Partage a en trois parts égales. | Share a into three equal parts. |
| `quadruple` | Le quadruple, c'est le double du double. | Quadruple means double, then double again. |
| `quarter` | Le quart, c'est la moitié de la moitié. | A quarter is half of a half. |
| `table` | Compte de a en a : a, 2a, 3a… (jusqu'à trois nombres, tous plus petits que la réponse : « 5 × 3 » donne « 5, 10… », correction de la relecture du 2026-11-18) | Count in a's: a, 2a, 3a… (same rule) |
| `timesPow10` | Multiplier par 10, c'est écrire un 0 à droite (par 100 : deux 0 ; par 1 000 : trois 0). | Multiplying by 10 adds one 0 on the right (100: two 0s; 1,000: three 0s). |
| `divPow10` | Diviser par 10, c'est enlever un 0 à droite (par 100 : deux 0 ; par 1 000 : trois 0). | Dividing by 10 removes one 0 on the right (100: two 0s; 1,000: three 0s). |
| `timesK` (5, 50, 500) | Multiplie par 10 (100, 1 000), puis prends la moitié. | Multiply by 10 (100, 1,000), then take half. |
| `timesK` (11) | a × 11, c'est a × 10 + a. | a × 11 is a × 10 + a. |
| `timesK` (12) | a × 12, c'est a × 10 + a × 2. | a × 12 is a × 10 + a × 2. |
| `timesK` (25) | a × 25, c'est a × 100, puis le quart. | a × 25 is a × 100, then a quarter. |
| `missingFactor` | Récite la table de a jusqu'à trouver c. | Say the a times table until you reach c. |

### 6.5 Page et carte

- Écran de choix : rappel de la classe utilisée (« Réglé pour : CE1 (francophone) », message si la classe du profil ne correspond pas, comme les nombres croisés) ; boutons des familles de la classe (avec leur nom) et « Mélange de la classe » (par défaut) ; numéro de partie ; mention « Démonstration : calculs générés, réglages à valider par un enseignant ».
- Écran de jeu : « Calcul i / n », le calcul en grand, la saisie, le message, l'indice, « Voir la réponse », « Suivant », le pavé.
- Fin : score, nombre de calculs trouvés et de réponses vues, liste des calculs avec leur réponse, « Nouvelle partie », « Retour ».
- Carte « Calcul mental » / « Mental maths », visible à tous les niveaux (toutes les classes ont au moins 3 familles).

## 7. Fichiers

- Nouveaux : `src/data/calcul-mental.js`, `src/utils/mentalMath.js` et `mentalMath.test.js`, `src/pages/MentalMathGame.jsx`, `src/styles/MentalMathGame.css`, `e2e/calcul-mental.spec.js`, `docs/calcul-mental.md`.
- Modifiés : `src/App.jsx`, `src/pages/StudentDashboard.jsx`, `PROJECT_STATUS.md`.
- Inchangés : `src/data/reglages-maths.js` (importé : `MATH_CLASSES`, `resolveMathClass`), `src/components/NumberPad.jsx`.

## 8. Choix à valider (M1 à M10)

| # | Choix | Proposition |
|---|---|---|
| M1 | Familles et bornes | Celles du lot 0, telles quelles, provisoires, marquées « démonstration » (choix 1a à 12a du 2026-11-12) |
| M2 | Longueur de série | 10 calculs (fiche M6) ; 9 si la famille n'en compte que 9 |
| M3 | Choix de la série | Une famille ou « Mélange de la classe » (par défaut) |
| M4 | Points | 10 par calcul trouvé, même après des erreurs ; 0 si la réponse est vue (P10) |
| M5 | Aides | Indice après 2 erreurs ; « Voir la réponse » après 3 (P10) ; textes du §6.4 |
| M6 | Reprise | Les calculs dont la réponse a été vue reviennent une fois en fin de série, sans points |
| M7 | SIL et Class 1 | Calculs sans mots ; l'indice (en mots) s'affiche quand même, pour l'adulte qui accompagne |
| M8 | Chronomètre | Aucun (P11) |
| M9 | Grands nombres | Groupés par trois : espace en français, virgule en anglais (révisé après la relecture enseignant du 25/11/2026) |
| M10 | Nom de la carte | « Calcul mental » / « Mental maths » |

## 9. Tests attendus

- **Réglages** (sur toutes les classes) : familles de chaque classe = tableau du §3 ; pour chaque famille, au moins 9 calculs ; chaque calcul énuméré respecte les règles du §4 (entiers positifs, soustraction ≥ 1, divisions exactes, pas de × 1 ni de + 0, multiplicateur de table de 2 à 10) ; aucun nombre affiché au-dessus du `maxNumber` de la classe ; aucun mot dans les calculs de SIL et Class 1 ; contrôles ponctuels des bornes du lot 0 (SIL C : 9 calculs, a de 1 à 9 ; CM1 I : c ≤ 100 ; CM2 H × 25 : résultat ≤ 300…).
- **Séries** : même graine, même série ; 10 calculs distincts ; 9 pour les familles de 9 ; le mélange contient chaque famille de la classe ; graine invalide refusée.
- **Réponses** : juste du premier coup = 10 ; juste après 3 erreurs = 10 ; indice visible après 2 erreurs seulement ; « Voir la réponse » après 3 seulement ; réponse vue = 0 point et reprise en fin de série, sans points ; une réponse après la résolution ne change rien.
- **De bout en bout** : série complète CE1 (mélange) avec score enregistré une fois ; erreurs, indice, réponse vue, reprise ; élève de SIL (calculs sans mots) ; élève anglophone (Class 4) ; double toucher sur « Suivant » ; 375 et 320 px sans débordement.

## 10. Ce qui reste au developer

- Forme exacte des bornes dans `calcul-mental.js`, et nom de chaque famille à l'écran.
- Mise en page (à partir des pages des pyramides et des nombres croisés).
- Messages exacts, sur le modèle des autres jeux.
