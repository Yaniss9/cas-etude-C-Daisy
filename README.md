# Daisy — La facture qui doit être juste (sujet C)

Cas pratique Daisy, sujet C : modèle de données et logique de facturation d'un atelier créatif (cours à l'unité, cartes de 10 séances, abonnements, bons cadeaux, stages).

**En une phrase :** un moteur de facturation en TypeScript pur, qui ne confond jamais ce qui est **vendu**, **encaissé**, **consommé** et **dû**, où une facture émise ne se modifie jamais, et dont chaque règle est prouvée par un test : 89 tests, couvrant **les 12 cas** de l'énoncé, dont les obligatoires C4, C6, C9 et C10.

---

## Sommaire

1. [Démarrage rapide](#démarrage-rapide)
2. [Ce qui est livré, et ce qui ne l'est pas](#ce-qui-est-livré-et-ce-qui-ne-lest-pas)
3. [Le modèle](#le-modèle)
4. [Les règles retenues, cas par cas](#les-règles-retenues-cas-par-cas)
5. [Réponses aux questions](#réponses-aux-questions)
6. [Architecture et choix techniques](#architecture-et-choix-techniques)
7. [Limites connues et suite](#limites-connues-et-suite)
8. [Partie 2 — Socle commun](#partie-2--socle-commun)

---

## Démarrage rapide

```bash
git clone https://github.com/Yaniss9/cas-etude-C-Daisy.git
cd cas-etude-C-Daisy
nvm use          # Node 22, version fixée dans .nvmrc
npm ci           # installe exactement les versions du package-lock.json
npm test         # lance les 89 tests du moteur de facturation
```

Aucune base de données ni variable d'environnement n'est nécessaire pour les tests : le moteur est du TypeScript pur.

| Commande | Ce qu'elle fait |
|---|---|
| `npm test` | Lance tous les tests (Vitest) |
| `npm run test:watch` | Relance les tests à chaque modification |
| `npm run check` | Types + lint + tests : à lancer avant chaque commit (c'est aussi ce que vérifie la CI) |
| `npm run dev` | Interface du rapprochement bancaire (C12) sur http://localhost:3000 |
| `npm run db:start` / `db:reset` / `db:stop` | Base Supabase locale (Docker requis, optionnelle) |

**Prérequis :** Node.js 22 ou plus, npm 10 ou plus. Docker uniquement pour la base locale. La CLI Supabase est une dépendance du projet : rien à installer globalement.

---

## Ce qui est livré, et ce qui ne l'est pas

| Élément | État |
|---|---|
| Analyse des 12 cas et règles écrites | ✅ Toutes les règles sont dans ce README et détaillées dans [`docs/regles-metier.md`](docs/regles-metier.md) |
| Calcul des montants (centimes, HT / TVA / TTC, arrondi symétrique) | ✅ Testé sur 100 000 montants |
| Modèle et registre immuable | ✅ |
| Cas obligatoires **C4, C6, C9, C10** | ✅ Implémentés et testés |
| Tous les autres cas (C1, C2, C3, C5, C7, C8, C11, C12) | ✅ Implémentés et testés |
| Schéma SQL Supabase | ⬜ Non commencé : conception décrite plus bas |
| Interface du rapprochement bancaire (C12) | ✅ Une page qui explique l'écart ligne par ligne (`npm run dev`) |

J'ai d'abord livré les quatre cas obligatoires de bout en bout, avec leurs tests, puis les huit autres, qui réutilisent pour la plupart les mêmes briques.

---

## Le modèle

### Quatre axes qui ne se confondent jamais

| Axe | Question | Où c'est stocké |
|---|---|---|
| **Vendu** | Qu'est-ce que l'atelier s'est engagé à fournir, à quel prix ? | `sales` (le fait métier) et `documents` (factures et avoirs : la trace légale, immuable) |
| **Encaissé** | Quel argent est réellement entré ou sorti ? | `payments` (un remboursement est un paiement négatif ; un paiement échoué ne compte pas) |
| **Consommé** | Quel service a réellement été rendu ? | `consumptions` (cours suivi, bon utilisé, annulation hors délai, expiration, clôture) |
| **Dû** | Qui doit quoi à qui, maintenant ? | **Nulle part : c'est calculé.** Facturé − payé pour le client ; acheté − consommé pour les droits prépayés |

Pourquoi séparer la vente du document ? Une même vente peut avoir plusieurs documents (C4 : facture + avoir ; C10 : facture fausse + avoir + bonne facture). Pourquoi séparer le document du paiement ? Une même facture peut avoir plusieurs paiements (C8 : un échoué puis un réussi ; C9 : acompte puis solde). Pourquoi ne pas stocker le « dû » ? Parce qu'on aurait deux sources de vérité qui finiraient par se contredire.

### Deux horloges

- **La TVA suit l'argent.** Pour une prestation de services, la TVA est exigible à l'encaissement. Pour un bon ou une carte « univoque », elle l'est dès la vente.
- **Le chiffre d'affaires suit le service.** Tant que le cours n'a pas eu lieu, l'argent encaissé est une **dette** envers le client (un prépaiement). L'atelier le **gagne** quand il rend le service, ou quand le droit du client expire.

### Les principes dont découlent toutes les règles

| # | Principe |
|---|---|
| P1 | Les quatre axes sont stockés séparément ; le « dû » est toujours calculé |
| P2 | Un document émis est **immuable** et numéroté en **séquence continue** ; toute correction est un nouveau document |
| P3 | La facture est émise quand la vente devient ferme ; elle porte l'échéancier, les encaissements sont suivis à part |
| P4 | La TVA collectée suit l'encaissement (ou la vente du bon) |
| P5 | Le chiffre d'affaires est reconnu quand le service est rendu |
| P6 | Un prépaiement se compte **en unités** (carte) ou **en euros** (bon) |
| P7 | Une somme conservée sans service rendu devient du chiffre d'affaires ; la TVA n'est pas reversée |
| P8 | Le prix est figé au moment de la vente |
| P9 | Une correction est datée du jour où elle est faite, jamais dans une période clôturée |
| P10 | Montants en centimes entiers ; HT = arrondi(TTC ÷ 1,2), TVA = TTC − HT |

---

## Les règles retenues, cas par cas

| Cas | Règle retenue | Résultat | État |
|---|---|---|---|
| **C1** Cours simple | Facture à la date de la vente, adressée au payeur | F-0001 du 12/01 : 75 € TTC = 62,50 € HT + 12,50 € TVA | ✅ testé |
| **C2** Annulation dans les délais | La facture ne bouge pas ; avoir total + remboursement | AV-0001 de −75 € ; facturé net 0 € | ✅ testé |
| **C3** Annulation hors délai | Délai : 48 h avant le cours, 48 h pile comprises. Hors délai, l'atelier garde l'argent ; aucun nouveau document ; chiffre d'affaires reconnu à la date prévue du cours ; la TVA n'est pas reversée (prix complet d'une prestation non remboursable, pas des arrhes) | 75 € conservés | ✅ testé |
| **C4** Carte remboursée | Les séances utilisées repassent au prix unitaire (la remise est la contrepartie de l'engagement sur 10 séances) | **425 € remboursés** (650 − 3 × 75) ; avoir partiel de −425 € ; 225 € conservés | ✅ testé |
| **C5** Carte expirée | Le solde (4 × 65 = 260 €) devient du chiffre d'affaires à l'expiration ; prolongation = on rouvre le droit et on annule cette reconnaissance, sans nouvelle facture | 260 € gagnés à l'expiration, puis annulés par la prolongation | ✅ testé |
| **C6** Bon cadeau | Bon univoque : facture à **Julien** (payeur) avec TVA à la vente ; **Léa** est bénéficiaire ; le solde expiré devient du chiffre d'affaires | Gagné en 3 temps : 75 €, 40 €, puis 35 € à l'expiration | ✅ testé |
| **C7** Abonnement résilié | Pas de prorata : « sans engagement » vaut pour les mois futurs ; accès jusqu'à la fin de la période payée (04/04) ; cours réservés dans la période honorés | Accès jusqu'au 04/04, aucun remboursement | ✅ testé |
| **C8** Prélèvement échoué | **Une seule facture** (la vente de la période est ferme) ; deux tentatives de paiement ; créance de 120 € entre les deux ; TVA exigible au paiement réel | 1 facture, 2 tentatives ; 120 € dus entre les deux | ✅ testé |
| **C9** Stage en deux fois | **Une seule facture** de 280 € à la réservation, avec échéancier calculé (84 € puis 196 € à J-7) ; annulation jusqu'à J-7 : tout est remboursé sauf l'acompte ; après J-7 : rien | Annulation le 25/02 (J-3) : **rien n'est remboursé** | ✅ testé |
| **C10** Erreur de facture | Avoir total + nouvelle facture, datés du jour de la correction | **3 documents** : F-0001 (+750 €), AV-0001 (−750 €), F-0002 (+75 €) ; 0 € dû | ✅ testé |
| **C11** Paiement mixte | Le bon est un **prépaiement déjà facturé**, ni une remise (qui réduirait la base de TVA), ni un simple moyen de paiement ; s'il couvre tout le prix, aucune nouvelle facture (comme en C6) | Facture de 75 € − 50 € de bon = 25 € à payer ; TVA de 4,17 € seulement sur la part payée par carte | ✅ testé |
| **C12** Rapprochement | Deux ponts distincts : du facturé à l'encaissé, puis de l'encaissé au virement Stripe ; l'écart non expliqué est affiché, pas masqué | Tableau ligne à ligne ; écart non expliqué de 24,68 € affiché | ✅ testé |

**Numérotation :** deux séries continues, `F-` pour les factures et `AV-` pour les avoirs. ⚠️ Je crois les séries distinctes admises si chacune est continue, mais c'est à confirmer avec un expert-comptable.

---

## Réponses aux questions

### 1. Une carte de 10 séances entamée, puis une hausse de tarif : que valent les 7 séances restantes ?

**Elles restent 7 séances**, et rien d'autre ne change. La carte est un droit prépayé **en unités** (`unit: "class"`), payé 65 € la séance, et le prix est figé au moment de la vente (P8) : la hausse de mars ne touche pas une vente de janvier. En comptabilité, chaque séance restante vaut toujours 65 € de dette envers la cliente, reconnue en chiffre d'affaires quand elle vient au cours.

C'est cohérent avec C4 : la valeur d'une séance n'est requalifiée **que si la cliente rompt l'engagement** (remboursement), et alors au tarif unitaire en vigueur au moment de la consommation. À l'inverse, un bon cadeau est un droit **en euros** (`unit: "euro"`) : après une hausse, il achète moins. Les deux comportements découlent du même principe P6.

### 2. Un bon cadeau offert par un tiers, utilisé en partie, dont le solde expire : qu'est-ce qui apparaît en comptabilité, et quand ?

| Date | Ce qui se passe | Document | Client | Chiffre d'affaires gagné |
|---|---|---|---|---|
| 10/12/2026 | Julien achète le bon (150 €) | Facture à **Julien**, TVA de 25 € dès la vente (bon univoque) | Julien | 0 € : l'argent est encaissé, mais c'est une dette envers Léa |
| 20/01/2027 | Léa l'utilise pour un cours (75 €) | Aucun nouveau document | Léa, bénéficiaire | +62,50 € HT |
| 15/03/2027 | Léa l'utilise sur un stage (40 €) | Aucun nouveau document | Léa | +33,33 € HT |
| 10/12/2027 | Le solde de 35 € expire | Aucun document | | +29,17 € HT, sans reversement de TVA |

L'atelier a **encaissé** 150 € le 10/12/2026, mais il les **gagne** en trois fois. Le total gagné est exactement le total encaissé (150 €, soit 125 € HT) : le test le vérifie.

⚠️ Si l'atelier vendait aussi des produits à un autre taux de TVA, le bon serait « polyvalent » : pas de TVA à la vente, mais à l'utilisation. Ce régime n'est pas implémenté (aucun cas ne l'exige), mais le modèle est prêt à l'accueillir, et dans Daisy, avec 70 ateliers, il devrait être un paramètre du bon.

### 3. Une facture émise avec une erreur de montant : que fait le système ?

**Il ne la modifie jamais.** Trois raisons :
1. **La loi :** une facture émise est inaltérable, et la numérotation doit rester continue et sans trou. Modifier ou supprimer une facture, c'est casser cette séquence.
2. **La période est clôturée :** la comptabilité déjà arrêtée ne doit plus bouger. Ce qui était faux à une date doit rester visible comme tel, et la correction doit apparaître à sa propre date (P9).
3. **La piste d'audit :** un contrôleur doit pouvoir reconstituer ce qui s'est passé.

Pour C10, `correctInvoice` émet un **avoir total** (AV-0001, −750 €), puis une **nouvelle facture** (F-0002, 75 €), tous deux datés du 22/02. Il existe **3 documents** à la fin. Le paiement de 75 € n'a pas bougé, car il est rattaché à la vente et non à la facture.

L'immuabilité est imposée **par le compilateur** : les champs de `BillingDocument` sont `readonly`. Toute tentative de modification est refusée avant même l'exécution.

Bonus : la TVA d'une prestation de services est exigible à l'encaissement. Comme seuls 75 € ont été encaissés, l'erreur n'a jamais généré de TVA fantôme de 125 €.

### 4. Comment je teste que la facturation est juste

```bash
npm test     # 89 tests, en moins d'une seconde, sans base de données
```

**1. Un fichier de test par cas de l'énoncé** (`tests/cases/`). Chaque test rejoue une histoire et vérifie le résultat, avec des noms qui se lisent comme l'énoncé. Extrait de C4 :

```ts
it("refunds 425 €: the 3 classes used are charged at the single price (650 - 3 × 75)", () => {
  const after = refundClassCard(nadiaWithClasses(3), "ent_c4", SINGLE_CLASS_PRICE_CENTS, "2026-03-15");
  expect(after.payments.at(-1)?.amountCents).toBe(-42500);
});
```

**2. Des invariants vérifiés sur 100 000 montants** (`tests/money.test.ts`) :
- HT + TVA = TTC, pour tous les montants de 0 à 1 000 € ;
- une facture et son avoir s'annulent exactement, pour tous les montants (c'est ce test qui a révélé le piège de `Math.round(-2.5)`, qui donne −2 au lieu de −3).

**3. Des tests d'immuabilité :** après chaque action, on vérifie que le registre d'origine n'a pas changé (`before.documents.length` vaut toujours 0).

**4. Des tests de garde-fous :** annuler une facture inexistante, consommer plus que le solde d'une carte, rembourser une carte déjà surconsommée… chaque cas lance une erreur explicite.

**5. La CI :** à chaque push, GitHub vérifie les types, le lint, les tests et le build.

**Méthode :** pour chaque cas, le test a été écrit **avant** le code (développement piloté par les tests). Le test est la spécification.

---

## Architecture et choix techniques

```
src/domain/            ← le moteur : TypeScript pur, aucune dépendance
├── money.ts           centimes, arrondi symétrique, décomposition HT / TVA
├── types.ts           vente, droit prépayé, document, paiement, consommation
├── ledger.ts          le registre immuable (les cinq listes)
├── invoicing.ts       factures, avoirs, numérotation, correction (C1, C2, C10)
├── payments.ts        paiements, remboursements, facturé / payé / dû
├── entitlements.ts    droits prépayés, consommations, bon cadeau, expiration, prolongation (C5, C6)
├── single-class.ts    annulation d'un cours, règle des 48 h (C2, C3)
├── class-card.ts      remboursement de carte (C4)
├── subscription.ts    fin d'accès après résiliation (C7)
├── workshop.ts        échéancier et annulation de stage (C9)
├── mixed-payment.ts   paiement mixte bon cadeau + carte (C11)
├── reconciliation.ts  explication de l'écart avec le virement Stripe (C12)
└── dates.ts           calculs de dates en UTC (J-7, fin de période, écart en heures)
tests/                 ← un fichier par module, et tests/cases/ : un fichier par cas
supabase/              ← configuration de la base locale (schéma à venir)
docs/regles-metier.md  ← l'analyse détaillée des 12 cas
```

**Pourquoi un moteur en TypeScript pur plutôt que tout dans Next.js et Supabase ?** Les tests s'exécutent en millisecondes, sans base de données, et une règle = une fonction = un test, ce qui se défend ligne par ligne. La base et l'interface ne servent qu'à faire entrer et sortir des données : si demain Daisy change de base, les règles ne bougent pas. Le prix à payer : le schéma SQL décrira le même modèle une seconde fois.

**Choix techniques à connaître :**
- **Centimes entiers** (75,50 € = 7 550) : en JavaScript, `0.1 + 0.2` vaut `0.30000000000000004`.
- **Arrondi symétrique** (`roundHalfAwayFromZero`) : un avoir est toujours le miroir exact de sa facture.
- **Registre immuable :** chaque action renvoie un nouveau registre (`{ ...ledger, documents: [...ledger.documents, invoice] }`) au lieu de modifier l'ancien. On garde l'historique, et les tests comparent simplement avant / après.
- **Dates en texte ISO** (`"2026-02-21"`) : elles ne dépendent pas du fuseau horaire et se comparent directement.
- **Conventions de nommage** reprises d'un projet existant (Qimo) : code en anglais, `camelCase`, types en `PascalCase`, constantes en `UPPER_SNAKE_CASE`.

**Le schéma Supabase prévu (non livré) :** une table par liste du registre ; un **trigger** qui refuse tout `UPDATE` ou `DELETE` sur les documents ; une **table de compteurs verrouillée ligne par ligne** pour la numérotation, car une `SEQUENCE` Postgres peut laisser des trous après un rollback, ce que la loi interdit.

---

## Limites connues et suite

**Limites assumées :**
- En C4, les 30 € de remise perdue ne sont pas comptés comme chiffre d'affaires gagné (seules les 3 séances à 65 € le sont).
- Le chiffre d'affaires d'un stage (C9) et d'un abonnement (C7, C8) n'est pas encore reconnu au fil du service : seuls les droits prépayés (cartes, bons, cours à l'unité) le sont.
- En C8, le délai de grâce pendant lequel Inès peut encore venir aux cours est une règle métier décrite, pas codée.
- En C12, la commission en pourcentage est calculée sur le total facturé, faute du détail des 87 transactions ; avec le détail réel, on la calculerait transaction par transaction, ce qui réduirait sans doute l'écart inexpliqué.
- Le bon cadeau polyvalent n'est pas implémenté (aucun cas ne l'exige).
- Les obligations de facturation électronique (calendrier 2026-2027) sont hors périmètre.
- ⚠️ Les points de TVA suivent la doctrine publique (BOFiP), mais je ne suis pas comptable : leur application réelle mérite l'avis d'un expert-comptable.

**Ce que je ferais ensuite, dans l'ordre :**
1. Le schéma SQL avec son trigger d'immuabilité et sa numérotation sans trou, testé avec PGlite (Postgres dans Node, sans Docker).
2. La reconnaissance du chiffre d'affaires des stages et des abonnements, et un export comptable par période.
3. Brancher l'interface du rapprochement sur les vrais paiements du registre, avec le détail transaction par transaction.

**Sur l'usage de l'IA :** j'ai utilisé un assistant IA tout au long du projet, pour analyser l'énoncé, comprendre les notions comptables, relire mon code et, sur la fin, écrire certaines fonctions que j'ai ensuite relues. Les règles métier et les arbitrages sont les miens.

---

## Partie 2 — Socle commun

### 1. Journal de bord

- **Temps :** environ 5 h, compréhension et développement compris.
- **Ordre :** analyse des trois sujets → choix du C (intérêt pour le métier, backend que je peux maîtriser) → règles des 12 cas écrites **avant** le code → installation (Next.js, Vitest, Supabase, CI) → calcul des montants → types → moteur cas par cas, tests d'abord, cas obligatoires en premier → README.
- **Blocage :** les notions comptables. J'ai d'abord calculé la TVA sur le TTC au lieu du HT.
- **Abandons :** le schéma SQL (conçu, non codé), le bon cadeau polyvalent, la reconnaissance du chiffre d'affaires des stages et abonnements.
- **IA :** utilisée pour comprendre les notions, relire mon code et, sur la fin, écrire des fonctions que j'ai ensuite relues.

### 2. Tri des tickets

**Du plus au moins envie :** 7 → 4 → 1 → 3 → 5 → 2 → 8 → 6

Ce qui me motive, c'est de résoudre un problème concret qu'un utilisateur a vraiment vécu, et de voir le résultat chez lui : un retour client est la critique la plus utile, et y répondre, c'est ce qui fait qu'il continue d'utiliser le produit. D'où l'export comptable faux (7) et le filtre réclamé par les artisans (4) en tête, et les chantiers sans demande client immédiate (design system, API publique) en dernier.

### 3. Mes deux premières semaines

Je commence en bêta-testeur : je me mets à la place d'un artisan et je touche à tout (créer un cours, prendre une réservation, émettre une facture) pour comprendre le produit de bout en bout, tout en lisant les conventions de code et de commit et la façon dont les fonctionnalités sont découpées. Une fois les grandes lignes comprises, je demande à un développeur confirmé de m'accompagner sur les revues de code, pour comprendre chaque étape et les choix de l'équipe.

### 4. La question que j'aurais posée

**« Dans la base actuelle de Daisy, comment sont stockés les montants (en centimes entiers ou en décimaux) et les factures (modifiables ou verrouillées) ? »**

**Ce que j'ai supposé à la place :** des montants en centimes entiers et des factures immuables. Tout mon moteur repose sur ces deux hypothèses. Si la base stockait déjà des montants en décimaux, ou si les factures pouvaient être modifiées, ce serait la première chose à discuter avant de brancher ce moteur sur l'existant.
