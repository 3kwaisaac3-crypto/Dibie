# Retours des enseignants — novembre 2026

**Source** : archive « VÉRIFICATION DIBIÈ » (71 pages scannées, remplies à la main), dépouillée le 2026-11-25 et le 2026-11-26. Les originaux ne sont pas dans le dépôt.

**Décisions d'Isaac** : 2026-11-26 (Maman / Papa / Mum, quiz en SIL-CP, TRICOT, guillemets) et 2026-11-27 (B15 DRUM accepté).

## 1. Documents reçus

| Document | Rempli par | Date | Pages |
|---|---|---|---|
| Fiche de relecture enseignant (`docs/fiche-enseignant.html`) | Enseignant de CM1-CM2, sous-système francophone | 24-25/11/2026 | 4 |
| L'intrus (60 items, `src/data/intrus.json`) | Enseignante | 20/11/2026 | 13 |
| Quiz des définitions, choix C1 à C8 | Enseignante de CE1 | 24/11/2026 | 2 |
| Anagrammes mystères, livret de validation français | Enseignant (initiales MP) | 19/11/2026 | 26 |
| Anagrammes mystères, livret de validation anglais | Enseignant | 25/11/2026 | 23 (page 12 absente) |

## 2. Ce qui est validé tel quel

- **L'intrus** : les 60 items sont cochés « Garder ». Il y a deux remarques, toutes deux positives (I-CM-01 « À conserver », I-CM-02 « Bon pour le niveau »). Ces retours vont sur la branche `feature/intrus-moteur-d` (pull request n° 35), qui n'est pas encore fusionnée.
- **Quiz** : les choix C2 à C5, C7 et C8 sont acceptés. C6 (double toucher) n'est pas coché.
- **Anagrammes mystères** :
  - les règles communes et les jeux 1 et 4 à 6 sont acceptés dans les deux livrets ;
  - les 22 thèmes sont acceptés, avec leurs propositions fausses, et les 5 thèmes sont jugés au bon niveau ;
  - les noms anglais The kitchen, Craftspeople et Farming conviennent ;
  - les découpages en syllabes sont justes, sauf MONEY (voir le §3) ;
  - les faits du jeu 6 sont jugés justes (ndolè, toghu, Mbango, proverbe, bikutsi).
- **Fiche de relecture** :
  - le vocabulaire (niveaux, définitions, sujets) est accepté ;
  - les paires sont acceptées, y compris la mémoire à 12 cartes et 1,2 s ;
  - les bornes et les tables du calcul mental sont acceptées ;
  - l'élève peut jouer seul, et la durée d'une partie convient.

## 3. Corrections appliquées (branche `feature/retours-enseignants`)

| Retour | Correction |
|---|---|
| Doublon NDOLÉ / NDOLÈ : « garder NDOLÈ » | `vocab_0529` (NDOLÉ, Alimentation) passe en `actif: false` ; `vocab_0669` (NDOLÈ, Cuisine) reste |
| MONEY se découpe MO-NEY, pas MON-EY ; parcours A14 (Monday) à ne pas garder | A14 (`syllabes-en-sil-cp-02`) est retiré. Le jeu 2 anglais en SIL-CP n'a plus qu'un parcours |
| A22 « Maman lave le pagne » : la phrase ne doit pas commencer par le mot à trouver | Maman (A22), Papa (A24) et Mum (A34) deviennent des mots donnés d'office, comme les prénoms (décision d'Isaac : même règle pour les trois) |
| 4 phrases anglaises acceptées mais peu naturelles (A39, A41, A42, A44) : « Non » | Ces variantes à virgules sont retirées des phrases acceptées. Les 5 variantes françaises restent (livret FR 3.8 : « Oui ») |
| A43 : écrire « treated mosquito net » | Nouvelle phrase : « Sleeping under a treated mosquito net helps protect us from malaria. » (« treated » est donné d'office) |
| Indices « The verb is is. », « The verb is can fly. » : à modifier ; l'enseignant a mis le verbe entre guillemets | Tous les indices du verbe : The verb is "cooks". En français aussi (décision d'Isaac) : Le verbe est « lave ». |
| TRICOT : la définition « Vêtement chaud fait de laine » ne correspond pas | Nouvelle définition, au sens local : « Maillot léger que l'on porte sur le haut du corps. » (décision d'Isaac) |
| Grands nombres en anglais : « 4,500 » | Le calcul mental écrit « 4,500 » en anglais et garde « 4 500 » en français (M9 révisé). Les nombres croisés le faisaient déjà |
| Quiz : ouvrir en SIL-CP avec l'aide des parents, 3 questions, et le dire dans l'espace Parents et enseignants | SIL-CP : 3 questions, 3 propositions, message « joue avec un parent ». Un conseil est ajouté dans l'espace Parent et dans l'espace Enseignant (C1 révisé, décision d'Isaac) |
| Parcours et thèmes validés | Statut `validated` pour les 43 parcours des jeux 2 et 3, les 18 parcours du jeu 6 (B15 DRUM, non coché, accepté par Isaac) et les 22 thèmes du jeu 4 |

## 4. Points restés en suspens

- **Lecture en SIL-CP** : les deux livrets répondent « L'élève seul », et la fiche dit « non » à la lecture à voix haute des définitions. C'est différent du quiz, où l'enseignante demande l'aide d'un parent. Rien n'est changé pour les autres jeux.
- **Noms de thèmes en SIL-CP** (livret FR 1.19) : l'élève ne peut pas les lire seul, et l'enseignant propose une image. Il faudrait des illustrations, qui ne sont pas encore prévues.
- **Code aléatoire du jeu 5** (livret FR 1.21) : « Oui » et « Non » sont cochés tous les deux. Le livret anglais répond « Oui ». On ne change rien.
- **« corner flag »** (livret anglais 5.4) : « Oui » et « Non » sont cochés tous les deux. On ne change rien.
- **WEB** (B10, Class 1-2) : l'enseignant a répondu « Je ne sais pas ».
- **Sujets peu connus** : la réserve du Dja (inconnue en SIL-CP et en Class 1-4) et le proverbe « patience… stone » (inconnu en CM et en Class 1-2). Ce sont des sujets à faire découvrir ; on garde les parcours.
- **Fiche, partie « Message codé »** : laissée vide.
- **Fiche, proverbe P1 du jeu 6** : non coché.
- **Fiche, remarque « CE1/CE2 » sur les tables de multiplication** : le sens n'est pas clair.

## 5. Essai hors ligne sur un vrai téléphone

Fait par Isaac le 2026-11-27, avec la version de production de cette branche : **concluant**. L'application était servie depuis le PC sur le Wi-Fi local. Sur le téléphone, Chrome Android avait le réglage « Insecure origins treated as secure » activé pour l'adresse du PC : le service worker exige une adresse sécurisée. Après une visite en ligne, le téléphone a été mis en mode avion, et les jeux ont continué à marcher. À refaire en HTTPS réel une fois l'application déployée.
