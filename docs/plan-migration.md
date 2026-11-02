# Dibiè-app : plan de migration et d'intégration

- **Date** : 2026-11-01
- **Statut** : PROPOSITION (étape B). **Aucun développement ne commence sans l'autorisation d'Isaac.**
- **Références** : [audit-architecture.md](audit-architecture.md), [architecture-cible.md](architecture-cible.md), [data-dictionary.md](data-dictionary.md).

---

## 1. Règles appliquées

Aucune reconstruction, aucun fichier supprimé, aucun jeu fonctionnel réécrit, aucune donnée source modifiée sans autorisation, aucun catalogue recopié. Chaque phase passe par sa propre branche, tous les tests unitaires (73 à l'audit, 104 à la fin de la phase 0) et la suite Playwright, puis le reviewer. Commit, push, pull request et fusion restent sur instruction d'Isaac, étape par étape.

---

## 2. Décisions à prendre par Isaac

| N° | Question | Recommandation |
|---|---|---|
| Q1 | Remplacer le courriel et le mot de passe par des profils locaux à **pseudonyme**, en gardant l'avis « Mode démonstration » ? | **Oui** : plus simple pour un enfant et aucune donnée réelle tant que l'application reste un prototype |
| Q2 | Sortie d'un jeu, depuis l'écran de choix **et** l'écran de fin : retour au tableau de bord au lieu de la connexion (revient sur la décision du 2026-10-09) ? | **Oui**, sinon l'élève ne voit jamais son total cumulé et quitte son profil dès l'écran de choix |
| Q3 | Faire passer le socle (phase 0) et le bilinguisme par matière (phase 1) avant l'étape 1 de l'ordre D2 ? | **Oui** pour la phase 0 ; la phase 1 peut suivre, car elle rend aussitôt accessibles les sciences et les TIC. L'ordre D2 reste ensuite inchangé |
| Q4 | Mots croisés en 15 colonnes, contraire à `Claude.md:35` ? Isaac a fait adapter ces 15 colonnes au téléphone le 2026-10-30 | **Garder 15** et corriger `Claude.md` pour les mots croisés seulement : la règle reste valable pour les mots mêlés (décision du 2026-10-05) |
| Q5 | Réglage des jeux de calcul : par classe et par sous-système ? | **Oui**, les programmes l'exigent ; bornes à faire confirmer par un enseignant (D4) |
| Q6 | Classement des sujets par matière (`audit-architecture.md`, annexe A) ? | **Validé par Isaac le 2026-11-02, à valider par un enseignant** |
| Q7 | Qui est l'enseignant désigné (D14) ? | Choix d'Isaac ; requis avant tout usage avec des élèves |
| Q8 | Scores et progrès sans limite dans `localStorage` : ne rien plafonner, ou garder un cumul par profil avant d'élaguer ? | **Ne rien plafonner en phase 0** : aucune perte, et le risque de saturation reste lointain avec les volumes actuels (estimation non mesurée) |

---

## 3. Fichiers à conserver sans modification

`src/utils/crosswordLayout.js` et son test ; `src/utils/wordSearchGenerator.js` et son test ; `src/components/EclipseGrid.jsx` ; `src/data/vocabulaire.json` ; `src/styles/CrosswordGame.css`, `EclipseGrid.css` ; `eslint.config.js` ; `e2e/combinaisons.spec.js` et `e2e/mots-croises.spec.js`, qui se connectent par `e2e/outils.js` (à vérifier au moment de la phase 0).

**Écart déclaré en phase 0** : `src/main.jsx`, d'abord prévu sans modification, **a été modifié**. L'enregistrement du service worker y a été déplacé depuis `index.html`, sous `import.meta.env.PROD` (voir §4).

`e2e/presentation.spec.js` est à adapter selon Q1 : ses premiers tests portent sur l'écran de connexion.

---

## 4. Phases

### Phase 0 : socle

**Objectif** : corriger les trois défauts confirmés et rendre la progression réelle.

| Fichier | Action | Modification minimale |
|---|---|---|
| `src/db/index.js` | Modifier | Fonctions de profils ; nom du profil dans `getAllUsersWithScores` (`db/index.js:183`) ; `loadVocabulaire` fusionne `dibieLocalVocab` ; `saveUserProgress` accepte `gameType` et `itemId` |
| `src/db/index.test.js` | **Créer** | Identité, statistiques, fusion de l'import. Nécessite une simulation de `localStorage` dans le test |
| `src/stores/appStore.js` | Modifier | `persist` pour `user`, `isAuthenticated`, `language`, `role`, `currentPage` : sans `isAuthenticated`, un rechargement afficherait une page vide (`App.jsx:48-55`). Selon Q1, `currentPage` initial et `logout` visent `profiles` |
| `src/pages/Profiles.jsx`, `src/styles/Profiles.css` | **Créer** | Choix et création d'un profil, avec l'avis « Mode démonstration » |
| `src/pages/Login.jsx` | Modifier ou retirer de `App.jsx` selon Q1 ; **fichier conservé** | Écran de démonstration ou aiguillage |
| `src/App.jsx` | Modifier | Ajouter la page `profiles` |
| `src/pages/RoleSelect.jsx` | Modifier | Accès adulte par code simple, présenté comme n'étant pas une sécurité réelle |
| `src/pages/CrosswordGame.jsx` | Modifier | **Seulement** : `handleBackToLogin` selon Q2 ; niveau par défaut lu dans le profil (`CrosswordGame.jsx:48`) |
| `src/pages/WordSearchGame.jsx` | Modifier | **Seulement** : `handleBackToLogin` selon Q2 |
| `src/pages/StudentDashboard.jsx` | Modifier | Afficher le niveau réel du profil |
| `src/pages/TeacherDashboard.jsx` | Modifier si nécessaire | Le nom vient de `db/index.js` ; afficher « Ancien profil » pour un score sans profil |
| `src/pages/AdminDashboard.jsx` | Modifier | Écrire dans `dibieLocalVocab` ; accepter les particularités constatées dans `DOC ED TECH DIBIE 2.csv` (fichier du poste de travail d'Isaac, hors dépôt) : BOM, colonne N°, en-têtes français (« Mot en français… ») répétés 7 fois, niveaux à tiret long. Isaac déclare `DOC ED TECH DIBIE.csv` équivalent (2026-11-01) |
| `public/service-worker.js` | Modifier | Mise en cache des fichiers du build dès l'installation. Le script lui-même doit changer à chaque version pour que le navigateur détecte la mise à jour : il sera donc réécrit dans `dist` au build |
| `vite.config.js` | Modifier | Petit module qui réécrit le service worker dans `dist` avec la liste des fichiers et un nom de cache versionné |
| `public/manifest.webmanifest`, icônes | **Créer** | Installation |
| `index.html` | Modifier | Lien vers le manifeste ; script d'enregistrement du service worker retiré |
| `src/main.jsx` | Modifier (écart au §3) | Enregistrement du service worker sous `import.meta.env.PROD` ; en développement, retrait d'un ancien service worker |
| `playwright.config.js` | Modifier | Projet ou serveur sur le **build**, car le service worker ne fonctionnera pas sur le serveur de développement |
| `e2e/outils.js` | Modifier | Connexion par profil |
| `e2e/hors-ligne.spec.js` | **Créer** | Une visite, coupure, partie complète |
| `e2e/progression.spec.js` | **Créer** | Partie, score visible, reconnexion et rechargement, score et session conservés |
| `e2e/import.spec.js` | **Créer** | Mot importé conservé après rechargement et disponible dans un jeu |
| `.env.example` | Modifier | Retirer `VITE_ANTHROPIC_API_KEY` ou l'accompagner d'un avertissement : une variable `VITE_` est exposée au navigateur |
| `README.md`, `Claude.md`, `PROJECT_STATUS.md` | Modifier | Écarts de l'audit §6 ; dans `Claude.md`, taille de grille selon Q4 |

**Tests de non-régression** : tests unitaires (73 à l'audit, 104 à la fin de la phase 0) ; suite Playwright ; même numéro de grille, même grille avant et après ; les trois défauts de l'audit couverts par les nouveaux tests e2e ci-dessus, et non plus par des sondes temporaires. **Vrai téléphone Android** à essayer en fin de phase.

**Risques** : un service worker défaillant peut bloquer les mises à jour, d'où un retour arrière à prévoir ; les tests Playwright dépendent de la connexion actuelle et devront être adaptés sans perdre leur portée.

### Phase 1 : bilinguisme et accès par matière

| Fichier | Action | Modification minimale |
|---|---|---|
| `src/data/sujets-matieres.js` | **Créer** | Table sujet → matière et traduction anglaise des sujets, après Q6 |
| `src/pages/StudentDashboard.jsx` | Modifier | Cartes regroupées par matière |
| `src/pages/CrosswordGame.jsx` | Modifier | Filtre par matière ; sujets, types et « Score » traduits, **sans toucher au moteur** ; message si une matière est vide pour un niveau (aucune entrée de maths ni de TIC en SIL-CP selon l'annexe A) |
| `src/utils/wordSearchGame.js` | Modifier | Paramètre facultatif de langue, français par défaut |
| `src/utils/wordSearchGame.test.js` | Modifier | Mêmes grilles en français ; nouveaux cas en anglais |
| `src/pages/WordSearchGame.jsx` | Modifier | Choix de la langue |

**Tests de non-régression** : les grilles françaises restent identiques pour un même numéro ; tous les sujets ont une matière ou restent accessibles ; aucun texte français résiduel en mode anglais sur les écrans couverts.

### Phases suivantes : ordre D2 du catalogue

| Phase | Étape de D2 | Contenu | Détail |
|---|---|---|---|
| 2 | 1 | Anagrammes (moteur B) | §5.4 ; D9 : indice = définition |
| 3 | 2 | Pyramides additives et multiplicatives, pavé numérique (moteur F) | §5.1 |
| 4 | 3 | Associations, mémoire, tables de multiplication (moteur C) | Passe de contenu préalable pour L4 (§5.2) |
| 5 | 4 | Nombres croisés | Réalisation forte selon le catalogue [ESTIMATION JARVIS — À VALIDER] |
| 6 | 5 | Grilles du maître | D11 : accès élèves seuls ; question ouverte des fichiers `.ecw` ; peut être avancée si les examens approchent (**date à fournir par Isaac**) |
| 7 | 6 | Quiz, intrus (moteur D), calcul mental | §5.2, §5.3 ; D5 : chronomètre désactivé par défaut |
| 8 | 7 | Familles de mots, classement (moteur E) | Contenu à rédiger et à vérifier ; D8 |
| 9 | 8 | Dominos, carrés magiques, suites logiques | Réutilisent les moteurs C et F |
| 10 | 9 | Mots codés, phrases mystère, phrase à reconstruire, relations entre les mots, conjugaison | Contenu rédigé important ; moteur G pour les mots codés |
| 11 | 10 | Fractions, mesures, ranger les nombres, le compte est bon, géométrie, mot ↔ image | Dessins ou banque d'images (D7) |
| 12 | Après les jeux (D15) | Suivi des parents et progression détaillée | Réutilise `dibieProgress`, sans nouveau système |

Aucune durée n'est donnée : elles ne sont pas connues à ce stade.

---

## 5. Plan d'intégration par catégorie de jeux

### 5.1 Mathématiques

| Étape | Résultat |
|---|---|
| Catalogues consultés | `catalogue-jeux-v0.2.md` §3 (M1 à M13), §5.2 ; `programmes-primaire-cameroun-v0.2.md` §2 et §5 |
| Ressources disponibles | Bornes, tables et monnaie par classe ; règles de qualité par jeu ; 324 entrées de maths, seulement pour les jeux de langue |
| Composants réutilisables | `createRandom`, `newSeed`, `isValidSeed` ; `saveScore`, `getUserStats` ; 10 points par réponse ; structure des pages de jeu ; carte du tableau de bord |
| Éléments manquants | Générateur et vérificateur de pyramides ; pavé numérique ; réglages par classe et sous-système ; validation des bornes par un enseignant |
| Nouveaux fichiers | `src/utils/mathGames.js` et son test ; `src/data/reglages-maths.js` ; `src/components/NumberPad.jsx` ; `src/pages/PyramidGame.jsx` ; `src/styles/PyramidGame.css` ; `e2e/pyramides.spec.js` |
| Fichiers modifiés | `src/App.jsx` (import et page) ; `src/pages/StudentDashboard.jsx` (une carte) |
| Tests de non-régression | Une seule solution pour chaque pyramide ; sommet dans la limite du niveau sur de longues séries de graines ; aucun résultat négatif ; même graine, même pyramide ; pavé utilisable à 320 px ; mots croisés et mots mêlés inchangés |

**Banque de contenus** : aucune. Les nombres sont générés, et les règles viennent des catalogues existants.

### 5.2 Sciences

| Étape | Résultat |
|---|---|
| Catalogues consultés | `catalogue-jeux-v0.2.md` §4, L8, L9, L10 |
| Ressources disponibles | 243 entrées de sciences et de santé (annexe A), avec définitions FR et EN ; aucune question rédigée |
| Composants réutilisables | **Déjà jouable en mots croisés**, dès le filtre par matière de la phase 1 ; `createRandom`, `saveScore` |
| Éléments manquants | Moteur de choix (phase 7) pour le quiz définition → mot, alimenté par le vocabulaire ; moteur de tri (phase 8) ; **contenu rédigé et vérifié** pour le classement et l'intrus, car `sujet` ne suffit pas (catalogue L9, L10, §4) ; contrôle par programme des définitions, passe reportée le 2026-10-09 et traitée en partie les 2026-10-28 et 29, préalable à L4 et L8 |
| Nouveaux fichiers | `src/utils/choiceGames.js` et son test ; `src/pages/QuizGame.jsx` ; `src/styles/QuizGame.css` ; `e2e/quiz.spec.js` ; en phase 8, `src/utils/sortGames.js`, sa page et ses tests |
| Fichiers modifiés | `src/App.jsx` ; `src/pages/StudentDashboard.jsx` |
| Tests de non-régression | Aucun mot inactif proposé ; une seule bonne réponse par question ; mauvaises réponses du même sujet et du même niveau ; quiz identique pour une même graine ; aucune définition contenant sa réponse |

**Validation** : les faits sont vérifiés par le researcher, puis par un enseignant.

### 5.3 Informatique et TIC

| Étape | Résultat |
|---|---|
| Catalogues consultés | `catalogue-jeux-v0.2.md` §4 (mots croisés, quiz) |
| Ressources disponibles | 116 entrées dans 7 sujets : 0 en SIL-CP, 59 en CE1-CE2, 57 en CM1-CM2 (annexe A) |
| Composants réutilisables | Mots croisés sans modification ; moteur de choix de §5.2 |
| Éléments manquants | Filtre par matière (phase 1) ; **aucun moteur propre** |
| Nouveaux fichiers | Aucun |
| Fichiers modifiés | `src/data/sujets-matieres.js` seulement |
| Tests de non-régression | Toutes les combinaisons de sujets TIC jouables, avec `e2e/combinaisons.spec.js` ; matière vide en SIL-CP gérée |

**Écart à signaler** : le rattachement de ces entrées aux TIC du programme n'a pas été vérifié pendant cet audit.

### 5.4 Langue : anagrammes

| Étape | Résultat |
|---|---|
| Catalogues consultés | `catalogue-jeux-v0.2.md` L1 ; décision D9 |
| Ressources disponibles | Vocabulaire avec définitions ; carte déjà affichée (`StudentDashboard.jsx:28`) |
| Composants réutilisables | `normalizeWord`, `createRandom`, `selectWords` comme modèle, `saveScore`, `saveUserProgress` |
| Éléments manquants | Moteur B ; **liste de mots interdits**, car les lettres mélangées peuvent former un mot inapproprié |
| Nouveaux fichiers | `src/utils/anagramGame.js` et son test ; `src/pages/AnagramGame.jsx` ; `src/styles/AnagramGame.css` ; `e2e/anagrammes.spec.js` |
| Fichiers modifiés | `src/App.jsx` ; `StudentDashboard.jsx` : `available: true` |
| Tests de non-régression | 3 lettres minimum ; le mélange diffère du mot ; toutes les anagrammes réelles acceptées (D9) ; même graine, même suite |

---

## 6. Risques techniques

| Risque | Gravité | Parade |
|---|---|---|
| Service worker défaillant qui bloque les mises à jour | Élevée | Nom de cache versionné ; test Playwright sur le build ; procédure de retour arrière |
| Page vide au rechargement si la session est mal restaurée | Élevée | `isAuthenticated` conservé ; cas couvert par `e2e/progression.spec.js` |
| Perte de données par effacement du navigateur | Élevée | L'expliquer aux adultes ; export en fichier plus tard |
| Tests e2e cassés par le nouveau parcours de connexion | Moyenne | Modifier `e2e/outils.js` à un seul endroit |
| Saturation de `localStorage` | Moyenne | Selon Q8 ; `dibieVocab` pourrait ne plus être copié, à examiner |
| Grilles déjà distribuées modifiées par un ajout de vocabulaire | Moyenne | Limite déjà annoncée à l'écran (« même version ») |
| Mots importés sur un seul appareil : un même numéro donne une autre grille dans la classe | Moyenne | L'indiquer dans l'écran d'import ; test dédié |
| Jeux utilisés avec de vrais élèves sans validation | Élevée | Mots interdits et validation par un enseignant, obligatoires avant usage |
| Paquet principal qui grossit | Faible | Chargement à la demande des nouvelles pages (`React.lazy`) si nécessaire ; 157,57 ko compressés aujourd'hui |

---

## 7. Retour arrière

Chaque phase tient dans une branche et une pull request, annulable par `git revert`. Les nouvelles clés de `localStorage` sont séparées des anciennes. Aucune ancienne donnée n'est effacée en phase 0 (selon la recommandation de Q8).
