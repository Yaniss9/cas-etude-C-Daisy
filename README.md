# Daisy — La facture qui doit être juste (sujet C)

Cas pratique Daisy, sujet C : concevoir le modèle de données et la logique de facturation d'un atelier créatif (cours à l'unité, cartes de 10 séances, abonnements, bons cadeaux, stages), puis implémenter le calcul.

> 🚧 **Ce README est pour l'instant un guide de lancement.** Les réponses aux questions de l'énoncé, les règles retenues et le journal de bord condensé y seront ajoutés à la fin du développement.

---

## Démarrage rapide

```bash
git clone <url-du-depot>
cd daisy-facturation
nvm use          # Node 22, version fixée dans .nvmrc
npm ci           # installe exactement les versions du package-lock.json
npm test         # lance les tests du moteur de facturation
```

Aucune base de données ni variable d'environnement n'est nécessaire pour lancer les tests : le moteur de facturation est du TypeScript pur.

## Prérequis

| Outil | Version | Utilisé pour |
|---|---|---|
| Node.js | 22 ou plus (voir `.nvmrc`) | Tout le projet |
| npm | 10 ou plus | Installation des dépendances |
| Docker | Récent, démarré | **Uniquement** pour la base Supabase locale (optionnelle) |

La CLI Supabase est installée comme dépendance du projet : rien à installer globalement.

## Commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm test` | Lance tous les tests une fois (Vitest) |
| `npm run test:watch` | Relance les tests à chaque modification |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run lint` | Vérifie le style du code (ESLint) |
| `npm run check` | Les trois vérifications ci-dessus d'un coup : à lancer avant chaque commit |
| `npm run dev` | Lance l'interface Next.js sur http://localhost:3000 |
| `npm run build` | Construit l'application pour la production |
| `npm run db:start` | Démarre Postgres et Supabase Studio en local (Docker requis) |
| `npm run db:reset` | Recrée la base locale : rejoue les migrations puis `supabase/seed.sql` |
| `npm run db:stop` | Arrête la base locale |

## Base de données locale (optionnelle)

```bash
npm run db:start   # le premier lancement télécharge les images Docker (quelques minutes)
```

Une fois démarrée :

| Service | Adresse |
|---|---|
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio (interface pour explorer les tables) | http://127.0.0.1:54323 |

Les services Supabase inutiles pour ce projet (realtime, stockage, emails, edge functions, analytics) sont désactivés dans `supabase/config.toml`, pour un démarrage plus léger.

## Architecture

```
src/
├── domain/              ← le moteur de facturation : TypeScript pur, aucune dépendance
└── app/                 ← interface Next.js (rapprochement bancaire C12), en dernière étape
tests/
├── cases/               ← un fichier de test par cas de l'énoncé (C1 à C12)
└── *.test.ts            ← invariants transverses
supabase/
├── config.toml          ← configuration de la base locale
├── migrations/          ← schéma SQL (tables, contraintes, immuabilité des factures)
└── seed.sql             ← données de démonstration
docs/
├── regles-metier.md     ← principes, analyse des 12 cas, décisions retenues
└── journal-de-bord.md   ← journal brut de mes choix et réflexions
```

**Le principe :** toutes les règles métier vivent dans `src/domain`, qui ne dépend ni de Next.js, ni de Supabase, ni du navigateur. La base de données et l'interface ne servent qu'à faire entrer et sortir des données. Les règles critiques (une facture émise ne se modifie pas, la numérotation est continue) sont vérifiées par le moteur **et** imposées par Postgres. Le raisonnement complet est dans [`docs/journal-de-bord.md`](docs/journal-de-bord.md) (entrée de 11:38).

**Stack :** Next.js (App Router), TypeScript en mode strict, Tailwind, Supabase (PostgreSQL 17), Vitest.

## Documentation

- [`docs/regles-metier.md`](docs/regles-metier.md) : les 4 axes (vendu, encaissé, consommé, dû), les 10 principes, l'analyse des 12 cas et les décisions retenues.
- [`docs/journal-de-bord.md`](docs/journal-de-bord.md) : le journal tenu au fil de l'eau, qui sera condensé à la fin.

## Avancement

- [x] Analyse des 12 cas et règles métier
- [x] Installation du projet (Next.js, Vitest, Supabase, CI)
- [ ] Calcul des montants (centimes, HT / TVA / TTC)
- [ ] Moteur : ventes, documents, paiements, consommations
- [ ] Tests des cas obligatoires : C4, C6, C9, C10
- [ ] Tests des autres cas
- [ ] Invariants
- [ ] Schéma SQL Supabase
- [ ] Interface du rapprochement bancaire (C12)
- [ ] README final : réponses aux questions et journal condensé
