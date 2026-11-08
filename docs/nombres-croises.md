# Nombres croisés (fiche M1, moteur F) : note de conception des lots A et B

- **Date** : 2026-11-08
- **Statut** : lot A fusionné (pull request n° 24, fusion 5c4e303). Relu par le reviewer (PRÊT) ; corrections de réglages décidées par Isaac le 2026-11-08 après lecture de l'échantillon par l'educator (§4 bis). Non validé par un enseignant (démonstration seulement, D14 ; Q7 ouvert).
- **Lot B** (interface, niveaux 1 et 2) : branche `feature/nombres-croises-lot-b` (non commitée), voir §8. Relu une fois par le reviewer le 2026-11-08 (NON PRÊT, réserves 1 et 3 corrigées, sans nouvelle relecture) ; non essayé par Isaac ; pas d'essai sur vrai téléphone.
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
2. **Au plus 40 % de divisions par grille** — CHOIX D'APPLICATION : la règle est appliquée à **toutes** les classes (sans effet visible hors CM : 11 à 12 % de divisions au CE). Arrondi à l'entier inférieur (8 nombres → 3 divisions au plus). Seul le type `div` est compté : moitié, tiers et quart (qui sont aussi des divisions pour l'élève) ne le sont pas — choix à soumettre à Isaac.
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

- Le lot A couvre **toutes** les classes CP / Class 2 à CM2 / Class 6 (instruction d'Isaac), alors que le §3 place le niveau 3 au lot C. Les types propres au lot C (nombre qui suit / qui précède, décomposition par rang, × / ÷ par 10, 100, 1 000 au CM, expressions avec priorité) ne sont **pas** faits ; × 10 et × 100 sont faits au CE2, où le §4.3 les place.
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

### 8.3 Choix provisoires du developer (à présenter à Isaac)

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
- Cadrage §3 : « essai d'Isaac sur ordinateur et sur vrai téléphone » : à faire par Isaac.

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
