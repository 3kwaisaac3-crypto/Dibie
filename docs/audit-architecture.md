# Dibiè-app : audit de l'architecture et de l'existant

- **Date** : 2026-11-01
- **Version auditée** : `main` = `0d49730`, version 0.1.0
- **Statut** : BROUILLON à valider par Isaac. Aucun code ni aucune donnée n'a été modifié.
- **Méthode** : lecture du code et sondes exécutées sur un build placé hors du dépôt.

Légende : **[TESTÉ]** exécuté le 2026-11-01 ; **[CODE]** établi par lecture du code, sans exécution ; **[DOC]** annoncé par un document, sans preuve dans le code.

---

## 1. Conclusion

Dibiè-app est un **prototype React qui fonctionne pour deux jeux de lettres**. Les moteurs de mots croisés et de mots mêlés sont solides et bien testés, et le vocabulaire est riche.

Le socle autour des jeux est plus faible, surtout **l'identité de l'élève** : le score n'est pas relié à une personne stable. **Tout suivi de progression dépend de ce point**, qui doit être réglé avant les profils et les nouveaux jeux à score.

Trois défauts ont été confirmés par exécution :

| N° | Défaut | Preuve | Conséquence |
|---|---|---|---|
| 1 | Le score disparaît après reconnexion | [TESTÉ] 50 points gagnés aux mots mêlés ; « Retour » puis reconnexion avec le même courriel : **0 point** affiché | Progression inutilisable. Cause : identifiant tiré au hasard à chaque connexion (`src/pages/Login.jsx:16`) |
| 2 | L'import CSV annonce un succès, puis le mot disparaît | [TESTÉ] « 1 mots importés avec succès », mot présent dans `dibieVocab`, puis **absent après rechargement** | L'import administrateur ne sert à rien. Cause : `loadVocabulaire` réécrit `dibieVocab` à chaque démarrage (`src/db/index.js:15`) et le cache mémoire n'est pas mis à jour (`src/db/index.js:5-11`) |
| 3 | Pas de hors ligne après une seule visite | [TESTÉ] Page **vide** hors ligne après une visite ; application fonctionnelle après deux visites | Risque réel en zone mal connectée. Cause : seuls `/` et `/index.html` sont mis en cache à l'installation (`public/service-worker.js:2-5`) |

---

## 2. Architecture technique constatée

| Élément | Constat | Source |
|---|---|---|
| Langage | JavaScript et JSX. Pas de TypeScript | `package.json`, fichiers `src/` |
| Interface | React 18 (composants fonctionnels) | `package.json` |
| État global | Zustand 4.5.7, sans persistance | `src/stores/appStore.js` |
| Build | Vite 8.2.2, un seul paquet JS | `vite.config.js` |
| Tests unitaires | `node --test` (Node 21 ou plus récent) | `package.json`, `README.md:43` |
| Tests navigateur | Playwright 1.64.1 avec Edge, 3 tailles d'écran | `playwright.config.js` |
| Contrôle du code | ESLint 9 | `eslint.config.js` |
| Point d'entrée | `index.html` → `src/main.jsx` → `src/App.jsx` | fichiers cités |
| Navigation | Variable `currentPage` et affichage conditionnel, sans routeur ni URL | `src/App.jsx:48-55` |
| Stockage | Cache mémoire et `localStorage`, sans IndexedDB ni Dexie | `src/db/index.js` |
| Hors ligne | Service worker manuel, enregistré dans `index.html` | `public/service-worker.js` |
| Serveur | Aucun : ni API, ni base distante, ni authentification réelle | [CODE] aucune trace de Firebase, Anthropic ou Capacitor dans `src/` et `package.json` |
| Installation | Pas de manifeste, pas de Capacitor, pas de dossier `android/` ou `ios/` | listage du dépôt |
| Médias | `public/favicon.svg` seulement : aucune image ni aucun son | `git ls-files` |

### Composants et modules

| Fichier | Rôle |
|---|---|
| `src/App.jsx` | Charge le vocabulaire, affiche la page active, le bandeau hors ligne et le sélecteur de langue |
| `src/stores/appStore.js` | Utilisateur, rôle, langue, page, état en ligne |
| `src/db/index.js` | Vocabulaire, scores, progrès, statistiques, badges |
| `src/pages/Login.jsx`, `RoleSelect.jsx` | Connexion simulée, choix libre du rôle |
| `src/pages/StudentDashboard.jsx` | Points, jeux, série, badges, cartes de jeux |
| `src/pages/TeacherDashboard.jsx` | Tableau des scores par identifiant |
| `src/pages/ParentDashboard.jsx` | Texte d'attente, sans données |
| `src/pages/AdminDashboard.jsx` | Import CSV |
| `src/pages/CrosswordGame.jsx`, `src/components/EclipseGrid.jsx` | Mots croisés : parcours et grille |
| `src/utils/crosswordLayout.js` | Moteur des mots croisés |
| `src/pages/WordSearchGame.jsx` | Mots mêlés : parcours et grille |
| `src/utils/wordSearchGame.js`, `wordSearchGenerator.js` | Moteur des mots mêlés (générateur 3.0.0) |

### Vérifications exécutées le 2026-11-01

| Vérification | Résultat |
|---|---|
| `npm test` | **Réussi** : 73 sur 73 |
| `npm run lint` | **Réussi** : aucune erreur |
| `vite build` (hors du dépôt) | **Réussi** : JS 631,35 ko, soit 157,57 ko compressés ; Vite avertit au-delà de 500 ko avant compression |
| `npx playwright test` | **Réussi** : 58 réussis, 20 ignorés, 0 échec sur 78, en 5,9 min |
| Sonde hors ligne, une visite | **Échoué** : page vide |
| Sonde hors ligne, deux visites | **Réussi** : connexion et tableau de bord élève affichés. Une partie complète hors ligne n'a pas été jouée |
| Sonde score après reconnexion | **Échoué** : 0 point affiché |
| Sonde import CSV | **Échoué** : mot perdu au rechargement |
| Vrai téléphone Android | **Non exécuté** |

Les sondes ont utilisé Edge sur le build temporaire. Aucun autre navigateur n'a été testé.

---

## 3. Fonctionnalités existantes

### Jeux et moteurs

| Élément | Constat |
|---|---|
| Mots croisés | Français, anglais ou bilingue ; 3 niveaux ; choix du sujet ; numéro de grille reproductible ; 10 points par mot ; mots de 2 lettres acceptés |
| Mots mêlés | Français seulement ; niveau sans choix de sujet ; 5, 7 ou 9 mots ; grilles 8, 10 ou 12 ; numéro de grille reproductible |
| Anagrammes | Carte « Bientôt » seulement (`StudentDashboard.jsx:28`) ; aucun moteur |
| Validation | Par lettre et par mot ; sujets injouables grisés ; mots composés écartés |
| Mots interdits | Mécanisme présent et testé, mais **liste vide** (`wordSearchGame.js:38`) : démonstration seulement, selon la décision d'Isaac du 2026-10-06 |

### Score et progression

| Élément | Constat |
|---|---|
| Score | `saveScore` enregistre le type de jeu, le score et le niveau, avec des détails libres |
| Progrès par mot | `saveUserProgress` n'enregistre que les réussites (`isCorrect` toujours vrai) ; durée fixée à 30 en mots croisés (`CrosswordGame.jsx:162`) et `null` en mots mêlés |
| Statistiques | `getUserStats` calcule points, parties, série et badges **pour tout type de jeu**, ce qui est réutilisable sans changement |
| Niveau de l'élève | Jamais renseigné : le tableau de bord affiche toujours « SIL-CP » (`StudentDashboard.jsx:43`) |
| Retour au tableau de bord | Impossible depuis un jeu : « Retour » déconnecte (décision du 2026-10-09). L'écran de fin montre le score de la partie, mais l'élève ne voit jamais son total cumulé sur le tableau de bord |

---

## 4. Ressources pédagogiques

| Ressource | Emplacement | Contenu | Statut |
|---|---|---|---|
| Vocabulaire | `src/data/vocabulaire.json` | 1 532 entrées (361 SIL-CP, 541 CE1-CE2, 630 CM1-CM2), 94 sujets, 107 couples niveau-sujet | BROUILLON ; validation par un enseignant requise |
| Catalogue des jeux | Dépôt JARVIS, `DIBIE/pedagogie/catalogue-jeux-v0.2.md` | 16 jeux de langue, 13 de mathématiques, 7 moteurs, ordre de construction | Décisions D1 à D15 prises ; validation par un enseignant requise |
| Programmes | Dépôt JARVIS, `DIBIE/pedagogie/programmes-primaire-cameroun-v0.2.md` | Curricula 2018, deux sous-systèmes ; nombres, tables et monnaie par classe | Copies non officielles ; à confirmer par des enseignants |
| Grilles d'Isaac | Dépôt JARVIS, `DIBIE/jeux/grilles-du-maitre/` | Inventaire des grilles et outils de lecture | Non intégré à l'application |
| Sources de vocabulaire | Dépôt JARVIS, `DIBIE/contenus/sources-vocabulaire-*` | Mots candidats, 8 287 nouveaux pour le primaire | Non trié ; droits à vérifier avant de reprendre des indices |
| Lots et révisions | Dépôt JARVIS, `DIBIE/contenus/` | Lots, définitions, regroupement des sujets | Historique de travail, déjà intégré pour l'essentiel |
| Images et sons | Aucun | — | Reportés (décisions D6 et D7) |
| Banque de questions, de calculs ou de faits scientifiques | Aucune | — | À créer selon le besoin |
| `docs/cahier-des-charges.md`, `docs/prd.md` | Dépôt Dibiè | Fichiers de **0 octet** | Existent mais sont vides |
| `docs/specs-niveaux/` | Poste de travail | Dossier vide | Existe mais ne contient aucun fichier |

**Répartition par matière.** Le vocabulaire n'a pas de champ « matière ». En classant les sujets (annexe A), on obtient **324 entrées de mathématiques, 243 de sciences et de santé et 116 d'informatique et de TIC**. Ce classement, proposé par JARVIS, est **validé par Isaac le 2026-11-02, à valider par un enseignant** : le chiffre des sciences dépend fortement des choix.

Ces entrées sont des **mots et des définitions**, pas des exercices : elles alimentent déjà les mots croisés, mais ne fournissent aucun calcul ni aucune question. Toutes ne sont pas placées dans une grille : les mots composés sont écartés et les mots mêlés n'utilisent que le français.

---

## 5. Cartographie : besoin, existant, écart

### Catégorie 1 : existant et opérationnel

| Fonctionnalité recherchée | Composant existant | Fichier | État actuel | Manque | Solution proposée | Risque de régression |
|---|---|---|---|---|---|---|
| Mots croisés | `CrosswordGame`, `EclipseGrid`, moteur | `src/pages/CrosswordGame.jsx`, `src/utils/crosswordLayout.js` | Jouable, testé | Essai sur vrai téléphone | Conserver | Faible si non modifié |
| Mots mêlés | `WordSearchGame`, générateur | `src/pages/WordSearchGame.jsx`, `src/utils/wordSearchGenerator.js` | Jouable, testé | Liste de mots interdits | Conserver | Faible si non modifié |
| Grilles reproductibles | `createRandom`, `newSeed`, `isValidSeed` | `src/utils/wordSearchGenerator.js`, `wordSearchGame.js` | Testé | — | Réutiliser pour les maths | Faible |
| Vocabulaire embarqué | `vocabulaire.json`, `getVocabBy*` | `src/data/`, `src/db/index.js` | Jouable sans réseau | — | Rester la source unique | Moyen si le format change |
| Tests | Unitaires et Playwright | `src/utils/*.test.js`, `e2e/` | 73 et 58 réussis | Rien sur `db/index.js` | Ajouter, ne pas remplacer | Nul |

### Catégorie 2 : existant mais à améliorer

| Fonctionnalité recherchée | Composant existant | Fichier | État actuel | Manque | Solution proposée | Risque de régression |
|---|---|---|---|---|---|---|
| Fonctionnement hors ligne | Service worker | `public/service-worker.js` | Fonctionne dès la deuxième visite | Première visite ; aucun test | Mettre les fichiers du build en cache dès l'installation | Moyen : un cache mal géré peut bloquer une mise à jour |
| Interface bilingue | Conditions par page | `src/pages/*.jsx` | FR et EN pour l'essentiel | Langue non conservée ; types et sujets non traduits ; `Score:` fixe ; niveaux jamais affichés en « Class » | Traduire par petites touches, sans bibliothèque | Faible |
| Contenu bilingue | `mot_en`, `def_en` | `vocabulaire.json` | Utilisé par les mots croisés | Mots mêlés en français seulement ; pas de `sujet` en anglais | Option de langue dans `selectWords` ; table de traduction des sujets | Moyen : reproductibilité des grilles |
| Statistiques élève | `getUserStats` | `src/db/index.js`, `StudentDashboard.jsx` | Calcul correct | Rendu inutile par l'identité aléatoire | Corriger l'identité | Faible |
| Import de vocabulaire | `handleImportVocab` | `src/pages/AdminDashboard.jsx` | **Défaut 2** | Conservation ; formats réels (`DOC ED TECH DIBIE 2.csv`) | Séparer vocabulaire de base et ajouts locaux | Moyen |
| Taille de grille | `GRID_SIZE = 15` | `src/utils/crosswordLayout.js:21` | Fonctionne | Contredit `Claude.md:35` (« pas 15x15 »), règle reprise pour les mots mêlés (décision du 2026-10-05) ; Isaac a toutefois fait adapter les 15 colonnes au téléphone (décision du 2026-10-30) | **Confirmation d'Isaac** pour les mots croisés seulement | Élevé si on change la taille |

### Catégorie 3 : partiellement développé

| Fonctionnalité recherchée | Composant existant | Fichier | État actuel | Manque | Solution proposée | Risque de régression |
|---|---|---|---|---|---|---|
| Profils élèves | `Login`, `setUser`, `role` | `src/pages/Login.jsx`, `appStore.js` | Simulé ; identité aléatoire ; session perdue au rechargement | **Identité stable, profils locaux** | Liste de profils locaux sans courriel ni mot de passe | Moyen : tests e2e à adapter |
| Tableau enseignant | `TeacherDashboard` | `src/pages/TeacherDashboard.jsx` | Tableau réel | Noms remplacés par des identifiants ; aucune notion de classe | Afficher le nom du profil | Faible |
| Tableau parent | `ParentDashboard` | `src/pages/ParentDashboard.jsx` | Texte d'attente | Tout le contenu | Après les jeux (décision D15) | Faible |
| Progression pédagogique | `saveUserProgress`, `difficulte` | `src/db/index.js`, `vocabulaire.json` | Réussites seules ; `difficulte` jamais lu par un jeu | Erreurs, résumé par notion | Enrichir le même enregistrement | Moyen : compatibilité des données déjà stockées |
| Choix du rôle | `RoleSelect` | `src/pages/RoleSelect.jsx` | Un élève peut ouvrir l'administration | Contrôle d'accès | Code simple pour l'adulte, sans valeur de sécurité réelle | Faible |
| Informatique et TIC | Sujets du vocabulaire | `vocabulaire.json` | **116 entrées** déjà proposées en mots croisés, dont 108 à mot français simple ; **aucune en SIL-CP** | Accès par matière ; quiz ; contenu SIL-CP si le programme le demande | Filtre par matière, qui devra gérer une matière vide | Faible |
| Sciences | Sujets du vocabulaire | `vocabulaire.json` | **243 entrées** déjà proposées en mots croisés, dont 233 à mot français simple | Accès par matière ; quiz ; **contenu rédigé et vérifié** pour le classement et l'intrus | Moteurs D et E du catalogue | Faible |
| Mathématiques (vocabulaire) | Sujets du vocabulaire | `vocabulaire.json` | **324 entrées** déjà proposées en mots croisés, dont 321 à mot français simple ; **aucune en SIL-CP** | Aucun calcul | Voir catégorie 4 | Faible |
| Limite de stockage | `localStorage` | `src/db/index.js` | Fonctionne ; `dibieScores` et `dibieProgress` croissent sans limite ; `dibieVocab` occupe 430 266 caractères | Solution de conservation | **Décision d'Isaac** : ne rien plafonner pour l'instant, ou garder un cumul par profil avant d'élaguer. Un plafond simple ferait baisser points et badges, car `getUserStats` additionne toutes les lignes | Élevé si plafond simple |

### Catégorie 4 : absent et à créer

Chaque élément a été recherché dans `src/`, `public/`, `e2e/`, `index.html` et `package.json`.

| Fonctionnalité recherchée | Composant existant | Fichier | État actuel | Manque | Solution proposée | Risque de régression |
|---|---|---|---|---|---|---|
| Jeux de calcul | Aucun | — | Absent | Moteur F et pavé numérique | Créer à côté de l'existant | Faible |
| Quiz, classement, associations | Aucun | — | Absent | Moteurs C, D, E | Créer, alimentés par le vocabulaire | Faible |
| Anagrammes | Carte « Bientôt » | `StudentDashboard.jsx:28` | Carte seulement | Moteur B | Créer ; réutiliser `normalizeWord` | Faible |
| Accès par matière | Aucun | — | Absent | Table sujet → matière | Table à part, sans toucher au vocabulaire | Faible |
| Manifeste d'installation | Aucun | — | Absent | `manifest.webmanifest`, icônes | Créer | Faible |
| Synchronisation | Aucune | — | Absent | Serveur, comptes | **Hors périmètre actuel** : à décider plus tard | — |
| Application Android | Aucune | — | Absent | Capacitor | Après la stabilisation du hors ligne | Faible |
| Audio et images | Aucun | — | Absent | Fichiers, droits | Reportés (D6, D7) | — |

---

## 6. Écarts entre la documentation et le code

Le code fait foi. Ces documents ne doivent pas servir de référence avant d'être corrigés.

| Annonce | Document | Réalité |
|---|---|---|
| Dexie, IndexedDB | `README.md:75,109`, `PROJECT_STATUS.md:21,36` | `localStorage` ; Dexie absent |
| Tailwind | `README.md:76` | Absent |
| Indices par l'API Anthropic ; difficulté adaptative | `README.md:97-98` | Absents |
| « Sync automatique » | `README.md:108` | Absente, aucun serveur |
| « App fonctionne 100 % sans connexion » | `README.md:107` | Faux après une seule visite |
| 869 mots | `Claude.md:40,67`, `PROJECT_STATUS.md:26` | 1 532 |
| `CrosswordGridVisual.jsx`, `CrosswordGrid.jsx`, `capacitor.config.json` | `Claude.md:54,75`, `PROJECT_STATUS.md:56` | Absents |
| Node 16+ | `README.md:10` | Les tests demandent Node 21 ou plus récent (`README.md:43`) |

**Point de sécurité.** `.env.example` prévoit `VITE_ANTHROPIC_API_KEY`. Toute variable `VITE_` est intégrée au code envoyé au navigateur : une vraie clé y serait donc exposée. Aucun code ne la lit aujourd'hui.

---

## 7. Incompatibilités à signaler

1. **Niveaux par tranche et programmes par classe.** Le code regroupe deux classes par niveau, alors que le SIL va jusqu'à 20 et le CP jusqu'à 100. Un jeu de calcul réglé par tranche ne convient donc pas aux deux classes.
2. **Deux sous-systèmes.** À rang égal, les bornes diffèrent (CE2 : 10 000 ; Class 4 : 5 000). La décision D3 vise les deux, mais rien dans le code ne distingue le sous-système.
3. **Connexion et enfants.** Le formulaire demande un courriel et un mot de passe, ce qui ne convient pas à de jeunes élèves. La règle du catalogue (§0.3, point 8) exclut toute donnée réelle d'élève tant que l'application reste un prototype.
4. **Décision « Retour » et progression.** La décision du 2026-10-09 ramène à la connexion. Avec des profils, elle empêche de voir sa progression après une partie : **à réexaminer par Isaac**.
5. **Appareil partagé.** `localStorage` appartient au navigateur : effacer les données du site efface tous les profils et tous les scores, sans sauvegarde.
6. **Mots interdits.** Tout jeu à lettres tirées au hasard reste limité à la démonstration tant que la liste n'existe pas.
7. **Numéro de grille.** Il ne reproduit la même grille qu'à version identique du vocabulaire : tout ajout de mots change les grilles déjà distribuées, et des mots importés sur un seul appareil feraient diverger les grilles au sein d'une classe.
8. **Matières vides par niveau.** Selon l'annexe A, aucune entrée de mathématiques ni de TIC n'existe en SIL-CP, alors que le programme de maths commence au SIL.

---

## Annexe A : classement des sujets par matière

**Proposé par JARVIS, validé par Isaac le 2026-11-02, à valider par un enseignant.** Les 41 autres sujets ne sont classés dans aucune de ces trois matières (Animaux, Géographie, Maison, Musique…). Recalculé le 2026-11-01 sur `vocabulaire.json`.

| Matière | Sujets | Entrées | Actives | Mot français simple | SIL-CP | CE1-CE2 | CM1-CM2 |
|---|---|---|---|---|---:|---:|---:|
| Mathématiques | Addition, Angles, Calcul, Cercle, Comparaison, Division, Droites, Finance, Fractions, Géométrie, Mathématiques, Mesures, Mesures / Géométrie, Mesures du temps, Multiplication, Nombres, Nombres décimaux, Numération, Opérations, Polygones, Problèmes, Problèmes / Finance, Proportionnalité, Quadrilatères, Repérage, Représentation des données, Segments, Solides, Soustraction, Symétrie, Transformations, Triangles | 324 | 323 | 321 | 0 | 14 | 310 |
| Sciences et santé | Sciences, Sciences / Mathématiques, Digestion, Matière, Matière / États, Matière / Mélanges, Corps humain, Climat, Nature, Environnement, Santé, Santé / Hygiène, Hygiène, Saisons | 243 | 242 | 233 | 26 | 110 | 107 |
| Informatique et TIC | Informatique, Internet, Logiciels, Matériel informatique, TIC, Technologie, Utilisation de l’ordinateur | 116 | 116 | 108 | 0 | 59 | 57 |

« Mot français simple » : parmi les entrées actives, lettres seulement, sans espace, tiret ni apostrophe. Ce filtre est une approximation de celui des jeux, et il ne dit rien de la colonne anglaise.
