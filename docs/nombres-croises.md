# Nombres croisés (fiche M1, moteur F) : note de conception du lot A

- **Date** : 2026-11-08
- **Statut** : lot A en cours sur la branche `feature/nombres-croises-lot-a` (non commité). Relu par le reviewer (PRÊT) ; corrections de réglages décidées par Isaac le 2026-11-08 après lecture de l'échantillon par l'educator (§4 bis), appliquées ensuite. Générateur et vérificateur **sans interface**. Non validé par un enseignant (démonstration seulement, D14 ; Q7 ouvert).
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
