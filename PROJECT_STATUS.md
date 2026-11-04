# 📊 DIBIÈ - Statut du Projet

**Date** : 2026-11-04
**Version** : Prototype de démonstration 0.1
**Status** : ⚠️ Prototype local non sécurisé, destiné aux démonstrations

> Cette application n’est pas prête pour la production. Les profils et les rôles sont simulés localement, sans backend ni sécurité réelle. N’utilisez aucune donnée sensible ou réelle.

---

## ✅ LIVRABLE FOURNI

### Fonctionnalités du prototype
- [x] Profils locaux à pseudonyme (sans courriel ni mot de passe), session conservée
- [x] Élève direct ; espace adulte (Prof, Parent, Admin) derrière une question, sans sécurité réelle
- [x] Jeu Mots Croisés Bilingues, avec accès par matière (classement validé par Isaac le 2026-11-02, à valider par un enseignant ; traductions des sujets à valider)
- [x] Jeu Mots Mêlés (français ou anglais, selon la langue de l'interface ; liste de mots interdits encore vide, démonstration seulement)
- [x] Jeu Anagrammes (phase 2, 2026-11-02 ; français ou anglais selon la langue de l'interface ; réglages par niveau provisoires, à valider par un enseignant ; liste de mots interdits encore vide, démonstration seulement)
- [x] Anagrammes mystères, lot 1 (2026-11-03, fusionné) : accueil des deux familles, jeu 1 « Mot mystère » et jeu 4 « Mystère des thèmes », moteur, règles de validation, reprise, étoiles ; liste des thèmes validée par Isaac, à valider par un enseignant
- [x] Anagrammes mystères, lot 2 (2026-11-04, branche `feature/anagrammes-mysteres-lot2`, non fusionnée) : jeu 5 « Message codé » (décisions C1 à C5 d'Isaac) ; jeux 2, 3 et 6 à venir
- [x] Jeu Pyramides additives et multiplicatives et pavé numérique réutilisable (phase 3, 2026-11-03 ; réglés par classe et sous-système du profil ; bornes reprises des programmes, provisoires, à valider par un enseignant de chaque sous-système)
- [x] Dashboard Élève (scores, badges, streaks)
- [x] Dashboard Enseignant (score total et nombre de parties par profil)
- [ ] Dashboard Parent (texte d'attente seulement, aucune donnée)
- [x] Dashboard Admin (gestion vocab)
- [x] Hors ligne après une visite en ligne (localStorage + Service Worker) ; vrai téléphone non essayé
- [x] Bilingue Français/Anglais
- [x] Responsive (mobile/tablette/desktop)

### Données
- [x] 1 533 entrées structurées
- [x] Niveaux : SIL-CP, CE1-CE2, CM1-CM2 (mappés Class 1-6)
- [x] Sujets : 94 (Maison, Transport, Alimentation, etc.)
- [ ] Doublons : 2 paires de même mot et même niveau restent dans `vocabulaire.json` (NDOLÉ / NDOLÈ et SOL, en CE1-CE2)
- [x] Définitions bilingues

### Infrastructure
- [x] Project structure React complète
- [x] Vite build tool configuré
- [x] Zustand pour state management
- [x] localStorage pour les données (Dexie et IndexedDB non utilisés)
- [x] Service Worker PWA
- [x] CSS responsive par page
- [x] Environment config

### Documentation
- [x] README.md (complet)
- [x] QUICKSTART.md (5 min setup)
- [x] .gitignore & config files
- [x] Code comments

---

## 📦 FICHIERS CRÉÉS

### Structure Répertoires
```
dibie-app/
├── src/
│   ├── components/           [Composants réutilisables]
│   │   ├── EclipseGrid.jsx   [Grille mots croisés]
│   │   ├── NumberPad.jsx     [Pavé numérique des jeux de calcul]
│   │   └── AnagramBoard.jsx  [Plateau d'une anagramme, partagé par les deux familles]
│   ├── pages/                [Pages principales]
│   │   ├── Profiles.jsx
│   │   ├── Login.jsx         [conservé, n'est plus affiché]
│   │   ├── RoleSelect.jsx
│   │   ├── StudentDashboard.jsx
│   │   ├── TeacherDashboard.jsx
│   │   ├── ParentDashboard.jsx
│   │   ├── AdminDashboard.jsx
│   │   ├── CrosswordGame.jsx
│   │   ├── WordSearchGame.jsx
│   │   ├── AnagramGame.jsx   [Accueil du module et anagrammes classiques]
│   │   ├── MysteryGame.jsx   [Anagrammes mystères]
│   │   └── PyramidGame.jsx
│   ├── stores/               [Zustand state]
│   │   └── appStore.js
│   ├── db/                   [localStorage]
│   │   └── index.js
│   ├── data/                 [Vocabulaire JSON, table sujet → matière, réglages de calcul]
│   │   ├── vocabulaire.json
│   │   ├── sujets-matieres.js
│   │   ├── themes-mysteres.js [liste fixe des thèmes du jeu 4]
│   │   └── reglages-maths.js [bornes et tables par classe et sous-système]
│   ├── styles/               [CSS pages]
│   │   ├── Login.css
│   │   ├── StudentDashboard.css
│   │   ├── CrosswordGame.css
│   │   ├── EclipseGrid.css
│   │   ├── Profiles.css
│   │   ├── WordSearchGame.css
│   │   ├── AnagramGame.css
│   │   ├── MysteryGame.css
│   │   ├── PyramidGame.css
│   │   ├── NumberPad.css
│   │   └── TeacherDashboard.css
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── public/
│   ├── service-worker.js     [réécrit au build]
│   ├── manifest.webmanifest
│   ├── favicon.svg
│   └── icons/
├── e2e/                      [tests Playwright]
├── index.html
├── vite.config.js
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── QUICKSTART.md
└── PROJECT_STATUS.md
```

---

## 🎮 COMMENT UTILISER LE PROTOTYPE

### 1. Télécharger & Setup (5 min)
```bash
npm install
npm run dev
# → http://localhost:3000
```

### 2. Tester localement
- Créer un profil à pseudonyme (pas de vrai nom)
- Jouer Mots Croisés
- Vérifier offline (F12 → Application → Offline)

Utilisez uniquement des données fictives : les profils et les rôles ne sont pas sécurisés.

### 3. Tests Enseignants (Fin Septembre)
- Déployer sur Vercel (gratuit)
- Partager lien avec 40 enseignants
- Recueillir feedback Google Form

---

## 🔜 À FAIRE APRÈS MVP

### Phase 2 (Septembre)
- [ ] Intégrer Anthropic API pour indices IA
- [x] Ajouter jeu Anagrammes (2026-11-02)
- [x] Anagrammes mystères, lot 1 (2026-11-03) et lot 2, jeu 5 (2026-11-04) ; lot 3 (jeux 2, 3, 6), lot 4 (validation enseignant) à faire
- [x] Ajouter jeu Pyramides et pavé numérique (2026-11-03)
- [ ] Ajouter jeu Dominos
- [ ] Améliorer UI animations

### Phase 3 (Octobre)
- [ ] Backend Node.js + PostgreSQL
- [ ] Sync données online/offline
- [ ] Analytics dashboard
- [x] Import CSV vocabulaire UI (ajouts locaux à l'appareil, déjà présent)

### Phase 4 (Novembre)
- [ ] App packaging Capacitor (APK/IPA)
- [ ] Déploiement production Hetzner
- [ ] Onboarding écoles
- [ ] Support multi-langues (FR/EN/Pidgin?)

---

## 🎯 OBJECTIFS TESTS (FIN SEPTEMBRE)

**Participants** : 40 enseignants, 400 élèves
**Niveaux** : SIL-CP, CE1-CE2, CM1-CM2 (groupes séparés)
**Sujets** : Maison + Transport (adapté par niveau)
**Feedback** : Google Form (hebdo)
**Durée** : 2-4 semaines de tests

**Critères Succès**
- [ ] 90%+ connexion successful
- [ ] 80%+ trouvent comment jouer
- [ ] 70%+ aiment expérience
- [ ] 0 bugs critiques
- [ ] Offline-first 100% fonctionnel

---

## 💰 BUDGET POST-LANCEMENT

### Année 1
| Item | Coût |
|------|------|
| Infrastructure (Hetzner) | $100/mois = $1,200 |
| Anthropic API | ~$150/an |
| Support Cameroun (1 personne) | $200/mois × 3 = $600 |
| **Total** | **~$2,000** |

### Revenue (Potentiel)
- Hypothèse de revenu brut, non vérifiée : 300 écoles × $300/licence = $90,000, sans déduction des coûts

---

## 📞 SUPPORT

Aucun canal de support (courriel, téléphone, adresse GitHub publique) n'est vérifié à ce jour.

---

## 🙏 Notes

Ce projet est un **prototype de démonstration uniquement**, non prêt pour la production.
Les profils et les rôles sont simulés localement. N’utilisez aucune donnée sensible ou réelle.
Le code est modulaire, facile à étendre et maintenir.
Vocabulaire peut être mis à jour facilement via admin panel.

**Bon courage pour les tests!** 🚀
