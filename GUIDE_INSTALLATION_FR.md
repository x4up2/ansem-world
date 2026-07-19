# ANSEM WORLD v4 — guide de test sur Mac

## 1. Tester immédiatement l'apparence (sans installer Node.js)

1. Décompresse l'archive.
2. Dans le dossier `ansem-world`, double-clique sur `START-PREVIEW.command`.
3. Si macOS bloque le fichier : clic droit > Ouvrir > Ouvrir.
4. Chrome doit ouvrir `http://localhost:8000`.
5. Pour arrêter le serveur, reviens dans Terminal et presse `Ctrl+C`.

Cette version est un aperçu statique : carte et chiffres de démonstration, sans connexion wallet fonctionnelle.

## 2. Lancer l'application complète en développement

Prérequis : Node.js 20.9 ou plus récent.

Dans Terminal :

```bash
node -v
npm -v
```

Si Node.js n'est pas installé et que Homebrew est disponible :

```bash
brew install node
```

Ensuite, dans le dossier du projet :

```bash
npm install
cp .env.example .env.local
npm run dev
```

Puis ouvre `http://localhost:3000`.

Tu peux aussi double-cliquer sur `START-DEV.command` : il installe les dépendances si nécessaire, crée `.env.local`, puis lance le site.

## 3. Vérifications de base

```bash
npm run typecheck
npm run build
```

Le premier contrôle vérifie TypeScript. Le second produit la version de production.

## 4. Tester un snapshot réel des holders

1. Crée une clé API Helius.
2. Ouvre `.env.local` et renseigne :

```env
HELIUS_API_KEY=ta_cle_ici
```

3. Lance :

```bash
npm run snapshot:holders
```

Un fichier `holders-snapshot.json` doit être créé à la racine du projet.

Attention : ce snapshot ne géolocalise personne. Il contient seulement les wallets et leurs soldes agrégés.

## 5. État actuel du MVP

Fonctionnel en démonstration : interface, carte, clusters, statistiques fictives, ouverture de la fenêtre de claim, connexion Phantom et signature côté navigateur, API de prototype, script de snapshot Helius.

Pas encore prêt pour une publication publique : vérification serveur des signatures, vérification du solde ANSEM, nonces, base Supabase, suppression des claims, synchronisation incrémentale et protections anti-abus.


## Correctif v4

Le conteneur de la carte possède maintenant une largeur et une hauteur explicites. Le CSS MapLibre est chargé avant le CSS du projet, afin que le mode Next.js affiche la carte comme le mode PREVIEW.
