# Dibiè-app : architecture cible

- **Date** : 2026-11-01
- **Statut** : PROPOSITION à valider par Isaac. Rien n'est développé.
- **Point de départ** : [audit-architecture.md](audit-architecture.md).

---

## 1. Principe

La cible est **l'application actuelle, complétée**. La pile reste la même : React, Vite, Zustand, `localStorage`, service worker manuel, tests `node --test` et Playwright.

Aucune nouvelle dépendance n'est nécessaire pour les étapes proposées. Aucun serveur n'est prévu : c'est une proposition qui respecte le fonctionnement sans réseau et l'absence actuelle de backend.

**Les jeux existants ne changent pas de fonctionnement.** Ils ne reçoivent que les retouches listées dans [plan-migration.md](plan-migration.md).

---

## 2. Vue d'ensemble

```text
index.html → main.jsx → App.jsx (page active)
                          │
      ┌───────────────────┼─────────────────────────┐
   Accueil              Tableaux de bord          Jeux
   Profils (nouveau)    Élève, Enseignant,        Mots croisés (existant)
   RoleSelect           Parent, Admin             Mots mêlés (existant)
                                                  Anagrammes (nouveau)
                                                  Pyramides (nouveau)
                                                  Quiz, Classement (nouveaux)
                          │
      ┌───────────────────┴─────────────────────────┐
   src/stores/appStore.js                     src/db/index.js
   état + session conservée                   scores, progrès, profils
                                                     │
                          ┌──────────────────────────┴───┐
                  src/data/vocabulaire.json        localStorage
                  source unique des mots           données de l'appareil
                  (+ ajouts locaux importés)
```

Chaque jeu reste construit comme aujourd'hui : **un module sans interface dans `src/utils/`, testé par `node --test`, et une page dans `src/pages/`**.

---

## 3. Ce qui est ajouté, et pourquoi

| Besoin | Élément | Justification |
|---|---|---|
| Identité stable | `dibieProfiles` dans `src/db/index.js` | Corrige le défaut n° 1 ; `userId` existe déjà partout dans les scores |
| Session conservée | Middleware `persist` de Zustand, déjà inclus dans `zustand` | Évite une dépendance |
| Accès par matière | `src/data/sujets-matieres.js` | Évite de modifier les 1 532 entrées du vocabulaire (décision D12 : champs ajoutés selon le besoin) |
| Jeux de calcul | `src/utils/mathGames.js`, `src/components/NumberPad.jsx` | Moteur F et pavé numérique, prévus par le catalogue (§0.4) ; aucune banque de calculs, les nombres sont générés et vérifiables |
| Réglages de calcul | `src/data/reglages-maths.js` | Reprend les bornes de `programmes-primaire-cameroun-v0.2.md` sans recopier le document |
| Sciences et TIC | `src/utils/choiceGames.js` (moteur D), puis `src/utils/sortGames.js` (moteur E) | Le quiz définition → mot s'alimente au vocabulaire ; le classement et l'intrus exigent un contenu rédigé et vérifié (catalogue L9, L10, §4) |
| Hors ligne dès la première visite | Liste de fichiers à mettre en cache, produite au build | Corrige le défaut n° 3 |
| Installation | `public/manifest.webmanifest` et icônes | Absents aujourd'hui |

---

## 4. Ce qui reste inchangé

- `crosswordLayout.js`, `wordSearchGenerator.js` et leurs tests.
- `EclipseGrid.jsx`.
- Le format de `vocabulaire.json`.
- Les catalogues et programmes, qui **restent dans le dépôt JARVIS** et ne sont pas recopiés ici.
- Le barème de 10 points par réponse (décision D10).
- `getUserStats`, qui compte déjà tout type de jeu.

---

## 5. Parcours cible

1. **Choix du profil** : l'élève touche son **pseudonyme** ou crée un profil local, sans courriel ni mot de passe. Tant que l'application reste un prototype, aucune donnée réelle d'élève n'est saisie (catalogue §0.3, point 8), et l'avis « Mode démonstration » de `Login.jsx:35-42` est repris sur cet écran.
2. **Tableau de bord** : points, série, badges et jeux, regroupés par matière.
3. **Jeu** : niveau pris dans le profil et modifiable. Les mots mêlés lisent déjà `user?.level` (`WordSearchGame.jsx:25`) ; les mots croisés prennent aujourd'hui le premier niveau (`CrosswordGame.jsx:48`) et demandent une petite retouche.
4. **Sortie d'un jeu** : depuis l'écran de choix comme depuis l'écran de fin, retour au tableau de bord, qui affiche le total. Ce point modifie la décision du 2026-10-09 et **demande l'accord d'Isaac**.
5. **Accès adulte** : enseignant, parent et administrateur derrière une courte question ou un code. Ce n'est **pas une sécurité réelle** et cela doit rester présenté ainsi.

---

## 6. Limites assumées

- **Les résultats restent sur l'appareil où l'élève a joué** : sans serveur, aucun enseignant ne voit les résultats d'une classe répartie sur plusieurs téléphones.
- **Pas de sauvegarde automatique** : un export et un import de fichier sont possibles plus tard.
- **`localStorage` reste suffisant pour l'instant** : `Claude.md:18` indique qu'IndexedDB a été abandonné à cause de bugs sous Windows, ce qui n'a pas été revérifié. À réexaminer si les données dépassent la limite du navigateur, souvent de l'ordre de 5 Mo (ordre de grandeur non mesuré ici).

Un serveur, des comptes réels ou un usage avec de vrais élèves changeraient ce cadre. Ils imposeraient un travail de sécurité et de protection des données de mineurs, à décider séparément.
