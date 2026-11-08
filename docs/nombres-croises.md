# Nombres croisés (fiche M1, moteur F) : note de conception des lots A, B et C

- **Date** : 2026-11-08
- **Statut** : lot A fusionné (pull request n° 24, fusion 5c4e303). Relu par le reviewer (PRÊT) ; corrections de réglages décidées par Isaac le 2026-11-08 après lecture de l'échantillon par l'educator (§4 bis). Non validé par un enseignant (démonstration seulement, D14 ; Q7 ouvert).
- **Lot B** (interface, niveaux 1 et 2) : fusionné (pull request n° 25, fusion 2e8cffa), voir §8. Relu une fois par le reviewer le 2026-11-08 (NON PRÊT, réserves 1 et 3 corrigées, sans nouvelle relecture) ; essai d'Isaac sur vrai téléphone positif le 2026-11-08 ; 13 choix provisoires du §8.3 confirmés par Isaac le 2026-11-08.
- **Lot C** (niveau 3 : CM1, CM2, Class 5, Class 6 à l'écran ; nouveaux types de définitions ; BODMAS en Class 4) : en cours sur la branche `feature/nombres-croises-lot-c` (2026-11-08), non commité, relu une fois par le reviewer le 2026-11-08 (NON PRÊT, réserve R1 corrigée sur décision d'Isaac ; second passage ciblé le 2026-11-08 : PRÊT), échantillon non lu par Isaac, pas d'essai sur vrai téléphone ; voir §9.
- **Source des règles** : `DIBIE/pedagogie/cadrage-phase5-nombres-croises-v0.1.md` (dépôt JARVIS), décisions P1 à P12 validées par Isaac le 2026-11-08 (option a partout).

## 1. Fichiers

| Fichier | Rôle |
|---|---|
| `src/data/reglages-maths.js` | Nouveau champ `operations` par classe (types de définitions permis, §4.3, P5 a) ; `null` en SIL et Class 1 (jeu non proposé, P2 a) |
| `src/utils/crossNumberGrid.js` | Géométrie des gabarits : lecture, nombres (suites ≥ 2 cases) numérotés comme aux mots croisés, analyse (règle 5 du §5), 8 symétries |
| `src/utils/crossNumberDefinitions.js` | Définitions fermées (P6 a) : structure `{ type, operands }`, calcul, contrôle des règles du programme, options possibles pour un nombre, textes FR et EN tirés de la même structure |
| `src/utils/crossNumberGame.js` | Gabarits et réglages par classe, remplissage par retour arrière, choix des définitions, `createCrossNumberGame`, `verifyCrossNumberGame`, affichage texte |
| `src/utils/crossNumberGame.test.js` | Tests unitaires (17 tests ; séries de 200 graines par classe) |
| `scripts/nombres-croises-echantillon.js` | Échantillon Markdown pour l'educator et Isaac ; mesure du temps de génération |

## 2. Architecture

```
createCrossNumberGame({ className, subsystem, seed })
  crossNumberSettings  ← reglages-maths.js (maxNumber, tables, maxOperand, operations)
                       + CROSS_NUMBER_SETTINGS (taille, chiffres, minTerm,
                         maxQuotientDigits, tablesPerGrid, featureTimes50)
                       + gabarits valides
  jusqu'à 20 essais :
    gabarit tiré selon son poids, symétrie au hasard (graine mêlée à la classe)
    planRequirements   : nombres préparés (2 produits des tables en Class 3-4 ;
                         un multiple de 50 au CM, deux derniers chiffres fixés)
    fillTemplate       : chiffre par chiffre, ordre de lecture, retour arrière
                         (0 en tête interdit, ≤ maxNumber dès le début du nombre,
                          nombre complet définissable, pas de doublon,
                          conditions des nombres préparés)
    chooseDefinitions  : types imposés d'abord, puis type le moins employé parmi
                         les types possibles, avec les limites par grille
    verifyCrossNumberGame (tout recalculé) → grille rendue seulement si ok
  sinon CrossNumberError('generation-failed') : aucune grille
```

- **Déterminisme (P12 a)** : même numéro + même classe + même sous-système = même grille. La langue n'intervient pas : chaque définition porte ses deux textes (`entries[].text.fr`, `.en`) ; l'interface (lot B) affichera celui de la langue choisie.
- **Erreurs** : `CrossNumberError` avec `code` = `not-playable` (SIL, Class 1, classe inconnue), `invalid-seed`, `generation-failed`.
- **Vérificateur** : indépendant du générateur ; recalcule les nombres du gabarit, les réponses depuis les chiffres, chaque définition depuis sa structure, les textes. Codes : `template`, `bad-size`, `cells`, `entries`, `answer`, `leading-zero`, `digits`, `max-number`, `duplicate`, `definition` (détail : `type-not-allowed`, `wrong-value`, `out-of-range`, `trivial`, `too-small`, `not-in-programme`, `reveals-answer`, `bad-structure`), `text`, `single-type`, `operand-is-answer`, `division-share`, `two-digit-divisions`, `tables-count`, `not-a-game`. Une entrée qui n'est pas une grille (`null`, nombre, objet incomplet) donne `ok: false`, jamais une exception.
- **Résultat** : `{ seed, className, subsystem, level, size, templateId, symmetry, rows, cells, entries, stats }` ; `entries[]` : `{ id ('3A', '3D'), number, direction, cells, length, answer, definition, text }`.

## 3. Réglages par classe (tous provisoires, D4)

| Classe | Grille | Chiffres | Types de définitions (`operations`) |
|---|---|---|---|
| CP | 3 × 3 | 2 | addition, soustraction, produit des tables (2, 4, 5), dizaines et unités |
| Class 2 | 3 × 3 | 2 | addition, soustraction, centaines-dizaines-unités (pas de produit : tables vides) |
| CE1 | 4 × 4 | 2-3 | addition, soustraction, tables 1-5, multiplication et division exacte par 2 à 9, double, moitié, triple, tiers |
| Class 3 | 4 × 4 | 2-3 (≤ 500) | addition, soustraction, tables 1-7 |
| CE2 | 5 × 5 | 2-4 | types du CE1 (tables 1-8, multiplicateur et diviseur jusqu'à 99) + quadruple, quart, × 10, × 100 |
| Class 4 | 5 × 5 | 2-4 (≤ 5 000) | addition, soustraction, tables 1-9 |
| CM1 | 6 × 6 | 2-6 | addition, soustraction, tables 1-10, × 5 / × 50 / × 500, division exacte |
| Class 5 | 6 × 6 | 2-5 | addition, soustraction, multiplication, division exacte, tables 1-10 |
| CM2 | 7 × 7 | 2-7 | types du CM1 + × 11, × 12, × 25 |
| Class 6 | 7 × 7 | 2-6 | comme Class 5 |

Règles par grille et par classe (corrections du 2026-11-08, §4 bis) :

| Classe | Terme ou nombre retiré ≥ | Quotient | Produits des tables par grille | × 50 / × 500 préparé |
|---|---|---|---|---|
| CP, Class 2 | 1 | — | sans limite | non |
| CE1, CE2 | 10 | — | sans limite | non |
| Class 3, Class 4 | 10 | — | au moins 2 | non |
| CM1 / Class 5 | 10 | ≤ 4 chiffres | au plus 2 | CM1 oui / Class 5 non |
| CM2 / Class 6 | 10 | ≤ 5 chiffres | au plus 2 | CM2 oui / Class 6 non |

Toutes classes : au plus 40 % de divisions par grille (arrondi inférieur) ; au plus 3 divisions par un nombre de 2 chiffres ; diviseur ≤ 99 ; multiplication (type `mul`) par un nombre de 2 chiffres : multiplicande ≤ 9 999 ; aucun opérande égal à la réponse d'un autre nombre de la grille.

Gabarits : 3 en 3 × 3, 3 par taille ensuite (T6-c, avec des nombres de 6 chiffres, sert seulement au CM1 ; T7-c, avec un nombre de 7 chiffres, seulement au CM2). Chacun est utilisé avec ses 8 symétries.

## 4. Choix provisoires du developer (à présenter à Isaac)

1. *(Remplacé le 2026-11-08, voir §4 bis : addition et soustraction ajoutées au CM1 et au CM2.)*
2. **Diviseur et multiplicateur limités à 99** quand le programme ne donne pas de limite (`maxOperand: null` : CM1, CM2, Class 5, Class 6). Conséquence : des divisions lourdes au CM2 (dividendes jusqu'à 9 chiffres, ex. « 848 593 151 ÷ 97 » observé par le reviewer ; « 78 782 496 ÷ 96 » dans l’échantillon) ; *corrigé le 2026-11-08 (§4 bis) : quotient plafonné à 4 ou 5 chiffres, au plus 3 divisions par un nombre de 2 chiffres ; la plus grande division de l'échantillon régénéré est « 1 723 018 ÷ 22 » (CM2)*.
3. **× 11 et × 12** (CM2, « quelques multiplications ») : multiplicande de 2 à 12 seulement ; **× 25**, **× 5 / × 50 / × 500** et **× 10 / × 100** : tout multiplicande ≥ 2.
4. **Addition** : chaque terme entre 20 % et 80 % du nombre quand c'est possible (pas de « 2 + 345 674 »), et toujours ≥ 10 à partir du CE1 / Class 3 ; **soustraction** : nombre retiré de max(2, 10 à partir du CE1 / Class 3) à n, premier terme ≤ maxNumber (1 seulement au CP et en Class 2 s'il n'y a pas d'autre choix).
5. **Produit des tables** : un facteur dans les tables de la classe (sauf 1), l'autre de 2 à 10 ; ordre des facteurs au hasard.
6. **Dizaines et unités** : décomposition usuelle seulement, parties nulles omises (« 6 dizaines » pour 60) ; pas de forme « 5 dizaines et 13 unités ».
7. **« Contient sa réponse »** (règle 6) : refus si l'écriture d'un opérande contient celle de la réponse (« 145 − 100 » pour 45, « 125 ÷ 5 » pour 25). Exception : dizaines et unités (les chiffres sont la définition).
8. **Pas deux fois le même nombre** dans une grille.
9. **Mélange des types** : pour chaque nombre, le type le moins employé jusque-là parmi les types possibles ; une grille de 4 nombres ou plus doit avoir au moins 2 types (sinon refusée et régénérée). Règle plus stricte que le cadrage (recommandation, pas règle du §5).
10. **Gabarits** : trouvés par une recherche automatique (script hors dépôt : densité, nombres croisés, gabarit d'un seul tenant pour 4 × 4 et plus) puis choisis par le developer ; validés par les tests. En 3 × 3 avec 2 chiffres, chaque ligne et chaque colonne doit avoir une case noire : 7 formes valides existent (symétries mises à part, recensement du reviewer sur les 512 grilles) ; deux sont retenues, « deux coins » (6 cases, 4 nombres, en deux morceaux, comme l'essai du developer) et « carré 2 × 2 » (4 cases dans un cadre 3 × 3). *Corrigé le 2026-11-08 : l'escalier `##./#../..#` (5 cases, 4 nombres, chacun croise un autre, d'un seul tenant) est ajouté ; trois gabarits 3 × 3 sont retenus.* Nombre de gabarits suffisant ou non : inconnu (§9, point 7).
11. **Limites de génération** : 20 essais (modèle des mots mêlés), 20 000 nœuds de recherche par essai.
12. **Graine mêlée à la classe** (hachage FNV-1a de « sous-système:classe ») : sans cela, la partie n° 1 commençait par les mêmes chiffres dans toutes les classes.
13. **Écriture des nombres** : groupes de trois chiffres dès 1 000 ; espace insécable en français (« 12 345 »), virgule en anglais (« 12,345 »).
14. **Libellés anglais** : « twice », « half of », « three times », « one third of », « four times », « one quarter of » ; « hundreds, tens, units » (H, T, U du programme). À confirmer par un enseignant anglophone (§9, point 5).
15. **Texte de la définition** : le calcul seul (« 23 + 45 »), sans « = ? » ; l'interface pourra l'ajouter.

## 4 bis. Corrections décidées par Isaac le 2026-11-08 (après lecture de l'échantillon par l'educator)

Constat de l'educator : CM1 / CM2 trop lourds (≈ 70 % de divisions, dividendes de 7 à 9 chiffres) ; Class 3 / 4 trop faciles et monotones (« 9 + 4 », « 6 + 20 »).

1. **Addition et soustraction au CM1 et au CM2** (acquis des classes précédentes, comme Class 5-6) ; le §4.3 du cadrage sera mis à jour par JARVIS.
2. **Au plus 40 % de divisions par grille** — CHOIX D'APPLICATION : la règle est appliquée à **toutes** les classes (sans effet visible hors CM : 11 à 12 % de divisions au CE). Arrondi à l'entier inférieur (8 nombres → 3 divisions au plus). Seul le type `div` est compté : moitié, tiers et quart (qui sont aussi des divisions pour l'élève) ne le sont pas — décidé par Isaac le 2026-11-08 (recommandation de JARVIS).
3. **× 50 et × 500 au CM** — MÉCANISME : avant le remplissage, un nombre d'au moins 3 chiffres est tiré au hasard parmi ceux dont les deux derniers chiffres ne commencent aucun autre nombre ; ses deux derniers chiffres sont fixés à « 00 » ou « 50 » (une chance sur deux), et sa définition est imposée en « × 50 » ou « × 500 » (« × 500 » choisi dès qu'il est possible). Si aucun nombre ne convient (cas du gabarit T6-c dans certaines symétries), rien n'est imposé. Mesure sur 200 graines : × 50 / × 500 sur **183 grilles sur 200 au CM1** et **200 sur 200 au CM2** ; « × 500 » reste rare (11 définitions au CM1, 10 au CM2 sur 200 grilles), parce qu'il faut un multiple de 500.
4. **Plafonds** : quotient ≤ 4 chiffres (CM1, Class 5), ≤ 5 chiffres (CM2, Class 6) ; diviseur ≤ 99 conservé ; au plus 3 divisions par un nombre de 2 chiffres par grille ; type `mul` par un nombre de 2 chiffres : multiplicande ≤ 4 chiffres. CHOIX D'APPLICATION : cette dernière limite ne vise que le type `mul` ; les types `times…` n'y sont pas soumis. Seuls × 25 et × 50 / × 500 (multiplicande libre) fournissent de grands nombres ; × 11 et × 12 gardent un multiplicande de 2 à 12 (§4, point 3).
5. **Termes ≥ 10** à partir du CE1 et de Class 3 (addition : chaque terme ; soustraction : le nombre retiré). Code `too-small`.
6. **Produits des tables** (comptés, après la relecture du reviewer, comme **toute multiplication de deux facteurs de 2 à 10**, quel que soit le type : « 9 × 5 » en × 5, « 3 × 8 » en multiplication, « 4 × 7 » en table ; fonction `isTableProduct`, générateur et vérificateur) : au moins 2 par grille en Class 3 et Class 4 — MÉCANISME : deux nombres de 2 chiffres tirés au hasard doivent être des produits des tables (contrainte du remplissage) et reçoivent un produit des tables ; un gabarit qui a moins de deux nombres de 2 chiffres fait échouer l'essai. Au plus 2 par grille au CM1, CM2, Class 5, Class 6.
7. **Aucun opérande égal à la réponse d'un autre nombre** de la grille (générateur et vérificateur, code `operand-is-answer`).
8. **3 × 3** : escalier ajouté. PROPOSITION RETENUE : **tirage pondéré** carré 2, escalier 2, deux coins 1 (40 % / 40 % / 20 % ; mesuré sur 1 000 graines au CP : 397 / 409 / 194). Justification : carré et escalier sont d'un seul tenant et chaque nombre en croise un autre ; les deux coins (deux morceaux, 2 cases croisées sur 6) restent possibles pour garder la seule forme à 6 cases et un peu de variété ; un retrait complet laisserait 2 formes seulement. Isaac peut demander le retrait (poids 0). **Le carré sera affiché au lot B comme une grille 2 × 2 sans cadre.**
9. **Vérificateur durci** : `verifyCrossNumberGame(null)` et toute entrée incomplète renvoient `ok: false` au lieu de lever une erreur.

Répartition des types mesurée sur 200 graines par classe après correction, y compris le décompte des produits des tables tous types confondus (part des définitions) :

| Classe | Répartition |
|---|---|
| CP | dizaines-unités 32 %, soustraction 31 %, addition 30 %, tables 7 % |
| CE1 | soustraction 15 %, addition 14 %, multiplication 13 %, moitié 13 %, division 12 %, tiers 12 %, double 10 %, triple 9 %, tables 3 % |
| CE2 | soustraction 11 %, addition 11 %, division 11 %, multiplication 10 %, moitié 10 %, quart 10 %, tiers 10 %, double 8 %, triple 7 %, quadruple 5 %, tables 4 %, × 10 / × 100 2 % |
| CM1 | division 27 %, addition 26 %, soustraction 26 %, × 5 / × 50 / × 500 13 %, tables 9 % |
| CM2 | addition 25 %, soustraction 25 %, division 25 %, × 5 / × 50 / × 500 11 %, tables 7 %, × 11 / × 12 6 %, × 25 2 % |
| Class 2 | soustraction 34 %, addition 33 %, centaines-dizaines-unités 33 % |
| Class 3 | addition 37 %, soustraction 37 %, tables 27 % |
| Class 4 | addition 39 %, soustraction 39 %, tables 22 % |
| Class 5 | soustraction 24 %, addition 23 %, division 23 %, multiplication 22 %, tables 7 % |
| Class 6 | soustraction 24 %, division 24 %, addition 23 %, multiplication 23 %, tables 6 % |

## 5. Écarts au cadrage

- Le lot A couvre **toutes** les classes CP / Class 2 à CM2 / Class 6 (instruction d'Isaac), alors que le §3 place le niveau 3 au lot C. Les types propres au lot C (nombre qui suit / qui précède, décomposition par rang, × / ÷ par 10, 100, 1 000 au CM, expressions avec priorité) ne sont **pas** faits au lot A (faits au lot C, voir §9) ; × 10 et × 100 sont faits au CE2, où le §4.3 les place.
- Règles ajoutées (plus strictes) : pas de doublon, au moins deux types par grille (choix 8 et 9).
- Corrections d'Isaac du 2026-11-08 (§4 bis) : addition et soustraction au CM1 / CM2 (le §4.3 du cadrage sera mis à jour par JARVIS) ; plafonds, termes ≥ 10, nombre de produits des tables, opérande ≠ réponse d'un autre nombre, escalier 3 × 3 : règles nouvelles, absentes du cadrage v0.1.

## 6. Vérifier et refaire

```
npm test                                   # tous les tests unitaires
node --test src/utils/crossNumberGame.test.js
node scripts/nombres-croises-echantillon.js <fichier.md>   # échantillon (graines 1 et 2)
node scripts/nombres-croises-echantillon.js --mesure 200   # temps de génération
```

## 7. Limites

- Aucune interface (lot B) ; temps de génération mesuré seulement sur la machine de développement, pas sur un téléphone.
- Temps de génération après les corrections du 2026-11-08 (500 graines par classe, machine de développement Intel i5-2430M, **pas un téléphone**) : moyenne de 0,2 ms (Class 2) à 3,5 ms (CM2) ; maximum 46,3 ms (CM2) ; au plus 4 essais sur 20.
- Réglages, types et libellés au statut brouillon ; aucun enseignant désigné (Q7).

## 8. Lot B : interface des niveaux 1 et 2 (2026-11-08)

Décisions appliquées : P2, P7 à P12 (option a), consignes d'Isaac du lot B. Classes jouables à l'écran : **CP, CE1, CE2, Class 2, Class 3, Class 4**.

### 8.1 Fichiers

| Fichier | Rôle |
|---|---|
| `src/utils/crossNumberPlay.js` | État d'une partie, module pur : sélection, saisie, ⌫, vérification, chiffre révélé, « Voir la réponse », points, zone affichée, disponibilité par classe (`crossNumberAvailability`) |
| `src/utils/crossNumberPlay.test.js` | 19 tests unitaires (NP1 à NP19), dont une partie complète sur 30 graines par classe du lot B |
| `src/pages/CrossNumberGame.jsx` | Écran : choix (numéro de partie), partie, fin ; FR et EN |
| `src/styles/CrossNumberGame.css` | Grille, liste des définitions, bas d'écran fixé ; reprend les classes d'écran des pyramides (`PyramidGame.css`) |
| `src/App.jsx`, `src/pages/StudentDashboard.jsx` | Page `crossNumberGame` et carte « Nombres croisés » du tableau de bord |
| `e2e/nombres-croises.spec.js` | 11 tests navigateur (× 3 projets : ordinateur, tablette, téléphone), dont 320 et 375 px |

### 8.2 Règles mises en œuvre

- **Classe** : celle du profil (`resolveMathClass`), comme les pyramides et M7. SIL et Class 1 : message « Pas encore de nombres croisés pour ta classe… Ce jeu s'ouvrira à partir de la classe CP / Class 2 » (P2 a, sur le modèle de M7). CM1, CM2, Class 5, Class 6 : message « Bientôt… » (lot C). Aucun bouton « Commencer » dans ces deux cas ; carte visible pour tous.
- **Grille de boutons** (aucun `<input>` ni `<textarea>` dans la partie, contrôlé par le test e2e) ; saisie au pavé `NumberPad` ou au clavier physique (chiffres, Retour arrière, Entrée sur une case du nombre choisi) (P10 a).
- **Sélection** : toucher une case choisit le nombre horizontal qui y passe, sinon le vertical ; un second toucher sur la même case (case active, ou case touchée juste avant si elle est fixée) passe à l'autre nombre (puis revient) ; toucher une définition de la liste choisit son nombre. Les nombres résolus ne se choisissent plus.
- **Saisie** : avance automatique ; les cases fixées sont sautées ; ⌫ : case remplie effacée, case vide : recul et effacement (règle des mots croisés).
- **Vérification** (P7 a) : ✓ actif quand toutes les cases du nombre sont remplies ; juste : nombre verrouillé (vert), ses chiffres restent pour les nombres croisés, le nombre suivant est choisi ; faux : message avec la définition, chiffres laissés à corriger, cases bordées de rouge.
- **Aides** (P8 a) : à la 2e erreur sur un nombre, un chiffre est révélé (orange, fixé) ; à la 3e, « Voir la réponse » montre le nombre (gris, 0 point, `isCorrect: false`). Un nombre dont toutes les cases sont fixées par des nombres montrés et des chiffres révélés, sans case fixée par un nombre trouvé, est montré d'office (choix n° 8 ci-dessous). L'origine de chaque case fixée est suivie (`fixedBy` : `found`, `shown` ou `revealed`, la plus forte gardée).
- **Points et enregistrement** (P9 a) : 10 points par nombre trouvé, même après erreur ou chiffre révélé ; `gameType` **`crossNumber`** ; aucun badge nouveau. `saveUserProgress` à chaque ✓ et à « Voir la réponse » (`itemId` = `sous-système:classe:numéro:nombre`, ex. `fr:CE1:2024:3A`). `saveScore` **une seule fois, dès le dernier nombre résolu** (« Retour » ou « Nouvelle partie » ne le font pas perdre ; « Terminer » n'enregistre pas une seconde fois), avec dans `details` : `seed`, `className`, `subsystem`, `templateId`, `numberCount`, `found`, `shown`, `revealed` (nombres avec un chiffre révélé), `errors`.
- **Disposition** (P11 a) : en-tête, grille, bouton « Toutes les définitions (n) » (liste repliée au départ), boutons « Nouvelle partie » / « Retour » ; en bas, **fixé** : définition courante (« 3 horizontal : 22 − 3 »), message, « Voir la réponse » si proposé, pavé. La page réserve en bas la hauteur de ce bloc (mesurée par `ResizeObserver`).
- **Graine et langue** (P12 a) : même numéro + même classe = même grille ; changer de langue pendant la partie ne change que le texte des définitions (contrôlé en e2e) ; si `createCrossNumberGame` lève une erreur, message « Aucune grille n'a pu être préparée avec ce numéro… », aucune grille.
- **Carré 3 × 3** : les rangées et colonnes entièrement noires du bord ne sont pas affichées (`visibleArea`) ; le carré s'affiche donc en 2 × 2 sans cadre (choix noté au §4 bis, point 8).
- **Fin** : score, erreurs, nombres avec chiffre révélé, réponses montrées ; grille complète (trouvé en vert, montré en gris) ; liste des définitions avec leurs réponses.

### 8.3 Choix du developer (confirmés par Isaac le 2026-11-08 : « confirmer les 13 choix provisoirement » ; n° 8 décidé à part)

1. **Pas de choix de classe à l'écran** : la classe vient du profil, comme les pyramides et M7 (le cadrage §4.4 dit « modifiable comme dans les pyramides » ; les pyramides ne la rendent modifiable que par le profil).
2. **CM1-CM2 et Class 5-6** : carte visible, message « Bientôt » sur la page (plutôt qu'une carte grisée, pour ne pas cacher le jeu aux autres classes sur un même appareil).
3. **Textes des messages SIL / Class 1** (« les nombres étudiés sont encore petits ; ce jeu s'ouvrira à partir de la classe CP / Class 2 ») : justification tirée du cadrage §4.1 (SIL) ; pour Class 1, l'exclusion reste une déduction de JARVIS (cadrage §9, point 1).
4. **Nom anglais « Number crossword »**, icône 🔢, `gameType` `crossNumber`.
5. **Chiffre révélé automatiquement** à la 2e erreur (pas de bouton), comme l'indice de la phase 4 qui apparaît seul ; chiffre choisi : la première case modifiable dont le chiffre écrit est faux. Le chiffre révélé est fixé et sert aussi au nombre qui croise. Il n'est compté que pour le nombre faux dans `details.revealed`, même s'il aide aussi le nombre croisé.
6. **Toucher une nouvelle case : horizontal d'abord**, même si le nombre déjà choisi (vertical) passe par cette case. Les mots croisés gardent, eux, le sens courant dans ce cas.
7. **Chiffres de trop ignorés** après la dernière case modifiable (comme la longueur limitée des pyramides) : un élève qui tape « 80 » alors que le 0 est déjà fixé n'écrase pas son 8. Toucher une case ou ⌫ permet de récrire. Ce blocage vaut aussi si des cases antérieures du nombre sont restées vides (l'élève doit alors toucher la case vide).
8. **Nombre entièrement fixé par les croisements** — *décidé par Isaac le 2026-11-08 (« Non, 0 point »)* : si toutes ses cases ont été fixées par des nombres montrés (« Voir la réponse ») et/ou des chiffres révélés, sans aucune case fixée par un nombre trouvé par l'élève, il passe aussitôt à l'état « montré », sans ✓ : 0 point, `isCorrect: false` dans `dibieProgress`, compté dans `details.shown`, message « Rempli sans toi (sans points) : … » (`resolveFilledByAids`, tests NP17 à NP19 et test e2e « choix n° 8 »). S'il a au moins une case fixée par un nombre trouvé, l'élève doit toucher ✓ et il rapporte 10 points.
9. **Après un nombre juste ou montré**, le nombre suivant non résolu dans l'ordre de la liste (horizontaux puis verticaux) est choisi.
10. **Définition affichée sans « = ? »** (« 22 − 3 », « le double de 34 », « 6 dizaines »).
11. **Bas d'écran fixé** (`position: fixed`, 480 px de large au plus pour ne pas passer sous le sélecteur de langue sur ordinateur) plutôt que collant : sur ordinateur, `.app` (`overflow-x: hidden`) empêchait un bloc collant de rester en bas. Touches du pavé : 46 px de haut (52 px dans les pyramides), 6 px d'écart.
12. **Taille de la grille** : largeur disponible, au plus 360 px (180 px pour 2 colonnes, 240 px pour 3), et au plus la hauteur de l'écran moins 420 px (au moins 200 px), pour que la grille 5 × 5 reste entière au-dessus du pavé à 320 × 640. Quand un message s'affiche, le bas d'écran grandit et peut couvrir la dernière rangée à 320 × 640 ; la page peut alors défiler.
13. **Message** gardé dans la langue du moment où il est apparu (comme les pyramides) ; les définitions, elles, suivent la langue.
14. **Aides notées dans les `details` de `saveScore`** seulement ; `saveUserProgress` n'enregistre que `gameType` et `itemId` (fonction inchangée).

### 8.4 Écarts au cadrage

- Cadrage §4.4 « Choix … modifiable comme dans les pyramides » : classe du profil seulement (choix 1).
- Cadrage §7 : « mesure [du temps de génération] sur téléphone au lot B » : **non faite** (aucun téléphone dans l'environnement du developer).
- Cadrage §3 : « essai d'Isaac sur ordinateur et sur vrai téléphone » : essai sur vrai téléphone fait par Isaac le 2026-11-08, positif (sans détail rapporté).

### 8.5 Vérifier et refaire

```
npm test                                             # tests unitaires (dont NP1 à NP19)
node --test src/utils/crossNumberPlay.test.js
npx playwright test e2e/nombres-croises.spec.js      # tests navigateur du jeu seulement
npm run lint
npm run build
```

### 8.6 Limites du lot B

- **Pas d'essai sur vrai téléphone** ; les tests à 320 et 375 px sont faits dans Edge (Playwright) avec une fenêtre de cette taille.
- Message d'échec de génération : chemin du code présent, **non déclenché en test navigateur** (aucune graine connue ne fait échouer la génération ; le cas d'échec est testé au lot A dans le module pur).
- Pas de flèches du clavier pour se déplacer dans la grille ; lecteur d'écran non essayé (étiquettes `aria-label` posées).
- Suite Playwright complète non relancée.

## 9. Lot C : niveau 3 et BODMAS (2026-11-08)

Source : cadrage §3 (ligne « Lot C »), §4.1, §4.3, §6 ; décisions P1 à P12 (option a). Branche `feature/nombres-croises-lot-c`, non commitée, relu une fois par le reviewer le 2026-11-08 (NON PRÊT, réserve R1 corrigée sur décision d'Isaac ; second passage ciblé le 2026-11-08 : PRÊT).

### 9.1 Fichiers

| Fichier | Modification |
|---|---|
| `src/utils/crossNumberDefinitions.js` | 7 types nouveaux : `next`, `prev`, `decomposition`, `timesPow10`, `divPow10`, `addProduct`, `subProduct` (calcul, contrôle, options, textes FR et EN) ; nouveau code de contrôle `too-long` |
| `src/data/reglages-maths.js` | Champ `operations` : CM1 et CM2 + `next`, `prev`, `decomposition`, `timesPow10`, `divPow10` ; Class 5 et Class 6 + `next`, `prev`, `decomposition` ; Class 4 + `addProduct`, `subProduct` |
| `src/utils/crossNumberGame.js` | Réglage `featureLevel3` (CM1, CM2, Class 5, Class 6) et nombre préparé pour le niveau 3 (`planRequirements`) ; `MAX_POW10_PER_GRID` (générateur et vérificateur, code `pow10-count`) |
| `src/utils/crossNumberPlay.js` | `crossNumberAvailability` : toutes les classes réglées sont jouables (`LOT_B_CLASSES` et l'état `soon` supprimés) |
| `src/pages/CrossNumberGame.jsx` | Message « Bientôt » supprimé ; défilement jusqu'au haut du jeu à l'ouverture d'une grille 6 × 6 ou 7 × 7 (choix 9) ; en-tête mis à jour |
| `src/styles/CrossNumberGame.css` | Grilles de 6 et 7 colonnes : taille, écart, chiffres et numéros |
| `src/utils/crossNumberGame.test.js` | N2 et N14 mis à jour ; N18 à N21 ajoutés |
| `src/utils/crossNumberPlay.test.js` | NP15 mis à jour ; NP20 et NP21 ajoutés |
| `e2e/nombres-croises.spec.js` | Test des classes non jouables mis à jour ; 8 tests ajoutés (disposition à 320 et 375 px, 4 parties complètes, aides en 7 × 7, BODMAS) |
| `scripts/nombres-croises-echantillon.js` | Libellés des types nouveaux ; options `--classes` et `--lot` |

Échantillon : `DIBIE/contenus/echantillon-nombres-croises-lot-c-v0.1.md` (dépôt JARVIS), produit par `node scripts/nombres-croises-echantillon.js <fichier.md> --graines 1,2 --classes "CM1,CM2,Class 5,Class 6,Class 4" --lot C`.

### 9.2 Règles mises en œuvre

- **Classes à l'écran** : CP à CM2 et Class 2 à Class 6 ; SIL et Class 1 gardent leur message (P2 a). Grilles 6 × 6 (CM1, Class 5) et 7 × 7 (CM2, Class 6), déjà couvertes par le générateur depuis le lot A.
- **Types ajoutés** (tous des définitions fermées, P6 a ; texte FR et EN tirés de la même structure `{ type, operands }`, recalculés par le vérificateur) :

| Type | Exemple FR / EN | Classes |
|---|---|---|
| `next` | « le nombre qui suit 4 599 » / « the number after 4,599 » | CM1, CM2, Class 5, Class 6 |
| `prev` | « le nombre qui précède 70 980 » / « the number before 70,980 » | CM1, CM2, Class 5, Class 6 |
| `decomposition` | « 4 centaines de mille, 5 dizaines de mille et 3 unités » / « 4 hundred thousands, 5 ten thousands and 3 units » | CM1, CM2, Class 5, Class 6 |
| `timesPow10` | « 45 × 1 000 » | CM1, CM2 |
| `divPow10` | « 45 000 ÷ 100 » | CM1, CM2 |
| `addProduct` | « 13 + 4 × 5 » (= 33) | Class 4 |
| `subProduct` | « 45 − 3 × 9 » (= 18) | Class 4 |

- **Règles des lots A et B conservées** (vérifiées par N6 sur 200 graines par classe et par N21 sur 50 graines par classe du lot C) : au plus 40 % de divisions par grille, seul le type `div` compté (décision d'Isaac du 2026-11-08 ; `divPow10` n'est donc pas compté) ; quotient ≤ 4 chiffres (CM1, Class 5) ou 5 chiffres (CM2, Class 6), diviseur ≤ 99, au plus 3 divisions par un nombre de 2 chiffres, multiplicande ≤ 9 999 (type `mul`) ; au plus 2 produits des tables au CM et en Class 5-6 (`timesPow10` « 7 × 10 » compté) ; aucun opérande égal à la réponse d'un autre nombre ; même graine + même classe = même grille ; 0 point pour un nombre rempli par les aides (NP21, test e2e en 7 × 7).
- **Exclus** : multiples et divisibilité (P6 b non retenue), définitions ouvertes, nombres négatifs, parenthèses.
- **Écran 6 × 6 et 7 × 7** (P11 a) : grille, définition courante et pavé fixé en bas, liste repliable, comme au lot B. Pour 6 et 7 colonnes, la hauteur réservée au pavé et à l'en-tête passe de 420 à 370 px, avec un côté minimal de 236 px (6 × 6) ou 264 px (7 × 7) et un écart de 3 ou 2 px ; à l'ouverture, la page défile jusqu'au haut du jeu (choix 9). Mesuré dans Edge (Playwright, numéro 3, après le défilement automatique de 44 px), à 320 × 640 : cases de 42,5 px (6 × 6) et 36,8 px (7 × 7), grille entière au-dessus du bas d'écran (bas de la grille à 384 px, haut du bloc fixé à 390 px) ; à 375 × 812 : 54,0 px et 46,7 px (bas de la grille à 453 px, bloc fixé à 562 px). Mesures de fenêtre, pas d'un vrai téléphone.

### 9.3 Choix provisoires du developer (à présenter à Isaac)

1. **Nombre qui suit / qui précède** : seulement pour une réponse d'au moins 4 chiffres, avec une retenue (« qui suit » : réponse terminée par 0 ; « qui précède » : réponse terminée par 9). Sans cette règle, « le nombre qui suit 45 123 » serait trivial au CM.
2. **Décomposition par rang** : nombre de 4 à 9 chiffres, au plus 3 rangs non nuls (au moins un zéro à placer, texte court sur téléphone) ; rangs « unités de mille », « dizaines de mille », « centaines de mille », « millions »… ; en anglais « thousands », « ten thousands », « hundred thousands »… (à confirmer par des enseignants, cadrage §9, point 5). Comme `placeValue`, pas de refus « contient sa réponse » (les chiffres sont la définition).
3. **× / ÷ par 10, 100, 1 000** : deux types nouveaux (`timesPow10`, `divPow10`) ; le type `times10` du CE2 (× 10, × 100) est inchangé. CM1 et CM2 seulement : le §4.3 ne les cite pas pour Class 5-6. Multiplicande ≥ 2, sans autre limite (comme × 10 au CE2) ; au plus 2 par grille, « × 10 / × 100 / × 1 000 » et « ÷ 10 / ÷ 100 / ÷ 1 000 » comptés ensemble (choix 4) ; « ÷ 10 » non soumis au plafond du quotient (calcul mental, pas une division posée) et dispensé du refus « contient sa réponse » (le dividende contient toujours le quotient suivi de zéros : c'est la règle étudiée).
4. **Au plus 2 « × / ÷ par 10, 100, 1 000 » par grille** (code `pow10-count`) : sans limite, « ÷ 10 » était possible pour presque tous les nombres et faisait 19 % des définitions au CM1 (200 graines) ; avec la limite, 8 à 11 %.
5. **Nombre préparé pour le niveau 3** (CM1, CM2, Class 5, Class 6) : un type est tiré parmi « qui suit », « qui précède », « décomposition » ; un nombre d'au moins 4 chiffres (au plus 5 pour la décomposition) reçoit d'avance son dernier chiffre (0 ou 9) ou ses deux derniers (« 00 »), puis ce type. Sans cette préparation, ces types faisaient 1 à 3 % des définitions (≈ 0,3 par grille) ; avec, un type du niveau 3 figure sur au moins 40 grilles sur 50 dans chaque classe (N21).
6. **Class 5 et Class 6 : « qui précède » ajouté à « qui suit »** : le §4.3 ne cite que « nombre qui suit » pour Class 5-6, mais la ligne « Lot C » du §3 cite les deux.
7. **BODMAS (Class 4)** : deux formes seulement, avec la multiplication en second, « a + b × c » et « a − b × c », les seules où l'ordre de calcul change le résultat (« 4 × 5 + 3 » se calcule de la même façon dans les deux ordres) ; b × c est un produit des tables de la classe (2 à 9 par 2 à 10) ; a ≥ 10 dans « a + b × c » (comme les termes d'une addition) et b × c ≥ 10 dans les deux formes (décision d'Isaac du 2026-11-08, réserve R1 du reviewer : « 10 + 3 × 2 » et « 11 + 2 × 4 » sont refusés, code `too-small`) ; résultat jamais négatif ; pas de division (absente des opérations de Class 4) ; le produit d'une expression n'est pas compté comme produit des tables.
8. **Part des expressions en Class 4** : environ 41 % des définitions après la règle b × c ≥ 10 (a + b × c 20 %, a − b × c 21 % sur 200 graines ; 42 % avant ; 2 types sur 5 avec la règle « type le moins employé ») ; le minimum de 2 produits des tables par grille est gardé. Réglable si Isaac ou l'educator trouvent cette part trop forte.
9. **Écran en 6 × 6 et 7 × 7** : sous 768 px de large, le sélecteur de langue est en haut de la page, dans le flux (`App.css`, anomalie A-02) ; à 320 × 640, avec lui, la dernière rangée d'une grille 7 × 7 passait sous le pavé (constaté par le test e2e). Solution retenue : à l'ouverture d'une partie en 6 × 6 ou 7 × 7, la page défile d'elle-même jusqu'au haut du jeu (une fois par partie) ; le sélecteur reste accessible en remontant. Le pavé garde sa taille (touches ≥ 44 px), les grilles plus petites ne changent pas. Si la définition ou le message prennent deux lignes, ou si l'écran fait moins de 640 px de haut, le bas d'écran fixé peut encore couvrir la dernière rangée ; la page peut alors défiler (sa place est réservée en bas de la page).
10. **Mêmes numéros, grilles différentes** : les grilles CM, Class 4, Class 5 et Class 6 d'un même numéro ne sont plus celles du lot B (nouveaux types). La règle P12 a vaut « avec la même version de l'application », comme l'indique l'écran.

### 9.4 Écarts au cadrage

- Choix 1, 2, 4, 5 : règles absentes du cadrage (plus strictes ou nouvelles).
- Choix 3 : exception à la règle 6 du §5 (« pas de définition qui contient sa réponse ») pour « ÷ 10, 100, 1 000 ».
- Choix 6 : « qui précède » en Class 5-6, non cité au §4.3 pour ces classes.
- Choix 9 : défilement automatique de la page à l'ouverture d'une grille 6 × 6 ou 7 × 7, non prévu au §6 (grille, définition courante, pavé fixé en bas) ; sans lui, à 320 × 640, la dernière rangée de la grille 7 × 7 passait sous le pavé.
- Cadrage §3, « correction des réglages après l'essai du lot B » : aucune correction rapportée par Isaac (essai positif, sans détail), donc aucune modification.
- Cadrage §3 et §6, « essai sur téléphone » et mesure du temps sur téléphone : **non faits** par le developer (aucun téléphone).

### 9.5 Tests et mesures (2026-11-08, machine de développement)

- `npm test` : 297 tests, 295 réussis, 0 échec, 2 ignorés (les 2 ignorés existaient avant le lot C ; avant le lot C : 291 tests, 289 réussis, 2 ignorés). Nouveaux : N18 à N21, NP20, NP21 ; mis à jour : N2, N14, NP15.
- `npx playwright test e2e/nombres-croises.spec.js` (seulement ce fichier, avec `DIBIE_URL` et un serveur `vite --host localhost --port 4181`) : 57 réussis sur 57 (19 tests × 3 projets : ordinateur, tablette, téléphone), 8,0 min. Un premier passage avait échoué sur le test « Lot C à 320 px » (3 projets) : grille 7 × 7 sous le pavé à cause du sélecteur de langue ; corrigé par le choix 9, puis relancé.
- `npm run lint` : aucune erreur ni avertissement (`eslint src`, qui ne couvre pas `e2e/` ni `scripts/`).
- `npm run build` : réussi ; avertissement de Vite sur un bloc de plus de 500 kB (non comparé à l'état d'avant le lot C).
- Temps de génération, `node scripts/nombres-croises-echantillon.js --mesure 500 --classes "CM1,CM2,Class 5,Class 6,Class 4"` (500 graines par classe ; Intel i5-2430M, **pas un téléphone**) :

| Classe | Grille | Moyenne | Médiane | 95e centile | Maximum | Essais au plus |
|---|---|---|---|---|---|---|
| CM1 | 6 × 6 | 3,8 ms | 2,8 ms | 6,6 ms | 61,4 ms | 4 |
| Class 5 | 6 × 6 | 3,0 ms | 2,7 ms | 4,9 ms | 41,2 ms | 2 |
| CM2 | 7 × 7 | 4,9 ms | 3,9 ms | 8,8 ms | 47,9 ms | 5 |
| Class 6 | 7 × 7 | 3,8 ms | 3,5 ms | 6,0 ms | 44,0 ms | 2 |
| Class 4 | 5 × 5 | 5,1 ms | 3,5 ms | 13,8 ms | 23,3 ms | 3 |

- Répartition des types sur 200 graines (mesure exploratoire, script hors dépôt) : CM1 : soustraction, addition, division 21 % chacune, × 5 / × 50 / × 500 10 %, ÷ 10 / 100 / 1 000 10 %, tables 8 %, qui suit 3 %, qui précède 3 %, décomposition 2 %, × 10 / 100 / 1 000 1 % ; CM2 : comparable (décomposition 4 %, × 11 / × 12 5 %) ; Class 5 et 6 : addition, soustraction, division ≈ 21 % chacune, multiplication 20 %, tables 6 à 8 %, types du niveau 3 ≈ 10 % ensemble ; Class 4 (après la règle b × c ≥ 10) : addition, soustraction, a − b × c 21 % chacune, a + b × c 20 %, tables 17 %.

### 9.6 Limites du lot C

- Relu une fois par le reviewer le 2026-11-08 (NON PRÊT, réserve R1 corrigée sur décision d'Isaac ; second passage ciblé le 2026-11-08 : PRÊT) ; échantillon non lu par l'educator ni par Isaac ; aucun enseignant (D14, Q7).
- Pas d'essai sur vrai téléphone ; tests à 320 et 375 px dans Edge (Playwright) seulement.
- Libellés anglais des types nouveaux (« the number after », « ten thousands ») et français (« unités de mille ») à confirmer.
- Suite Playwright complète non relancée (seul `e2e/nombres-croises.spec.js`).
