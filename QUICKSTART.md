# 🚀 DÉMARRAGE RAPIDE - PROTOTYPE DIBIÈ

> **Mode démonstration uniquement** : les profils et les rôles sont simulés localement, sans backend et sans sécurité réelle. N’utilisez aucune donnée sensible ou réelle. Ce prototype n’est pas prêt pour la production.

## Installation (5 minutes)

### 1. Télécharger et extraire le projet
```bash
unzip dibie-app.zip
cd dibie-app
```

### 2. Installer les dépendances
```bash
npm install
```
*(Première fois seulement - prend 2-3 min)*

### 3. Lancer l'app
```bash
npm run dev
```

### 4. Ouvrir dans le navigateur
```
http://localhost:3000
```

---

## 🎯 Test Rapide

### Créer un profil de démonstration
1. Écrire un pseudonyme (pas de vrai nom)
2. Choisir le niveau
3. Cliquer **Créer et jouer** : le tableau de bord s'ouvre

Les adultes passent par **Espace adulte**, derrière une simple question qui n'est pas une sécurité réelle.

### Jouer
1. Cliquer sur **Mots Croisés**
2. Choisir niveau (SIL-CP, CE1-CE2, CM1-CM2)
3. Choisir sujet (Maison, Transport, etc.)
4. Cliquer **Commencer**
5. Remplir les cases

---

## 🌐 Mode Bilingue

### Changer langue
- Écran des profils : Clicker 🇫🇷 Français / 🇬🇧 English
- Ensuite : sélecteur FR / EN de l'application

---

## 📊 Données Vocabulary

**Fichier** : `src/data/vocabulaire.json`

- 1 532 entrées
- Niveaux : SIL-CP, CE1-CE2, CM1-CM2
- Sujets : Maison, Transport, Alimentation, etc.

---

## 🔧 Config Avancée

### Clé Anthropic (indices IA, non réalisés)
Ne jamais placer de clé dans une variable `VITE_` : elle serait envoyée au navigateur.

---

## ❓ Problèmes ?

**Port 3000 déjà occupé ?**
```bash
npm run dev -- --port 3001
```

**Dépendances cassées ?**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Service Worker pas activé ?**
- Ouvrir DevTools (F12)
- Application → Service Workers
- Vérifier "Status"

---

## 📱 Tester sur Mobile

Application Android ou iPhone : **non disponible**, Capacitor n'est pas installé.

Le prototype se teste dans le navigateur du téléphone, à partir du build. L'essai sur un vrai téléphone reste à faire.

---

## 📤 Envoyer à Enseignants

### Méthode 1 : Lien web de démonstration
1. Build : `npm run build`
2. Deploy sur Vercel : https://vercel.com
3. Partager le lien en indiquant clairement qu’il s’agit d’un prototype non sécurisé

### Fichier APK : non disponible
Capacitor n'est pas installé et aucun APK n'existe.

---

## 📋 Checklist Test Enseignants

- [ ] Créer un profil ?
- [ ] Changer langue (FR/EN) ?
- [ ] Jouer mots croisés ?
- [ ] Voir scores ?
- [ ] Offline marche ? (désactiver WiFi)

---

Aucun canal de support n'est vérifié à ce jour.
