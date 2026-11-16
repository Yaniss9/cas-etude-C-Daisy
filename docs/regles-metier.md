# Sujet C — Analyse approfondie et règles métier

> Analyse détaillée des 12 cas, qui a servi de base au README. Les décisions D1 à D8 sont tranchées (section 6).
> Les options marquées 🟡 ont été discutées, l'option retenue est signalée par ⭐. En cas de différence avec le README ou le code, ce sont eux qui font foi.
> ⚠️ Je ne suis pas comptable : les points de droit ont été vérifiés sur des sources publiques (liste en fin de document), mais ils mériteraient une validation par un expert-comptable avant d'aller en production.

---

## 1. Le cadre : quatre axes à ne jamais confondre

L'énoncé insiste : le modèle ne doit pas confondre **vendu / encaissé / consommé / dû**. On en fait quatre axes indépendants, chacun avec sa propre source de vérité :

| Axe | Question | Source de vérité | Exemple (carte 10) |
|---|---|---|---|
| **Vendu** | Qu'est-ce que l'atelier s'est engagé à fournir, à quel prix ? | Les **documents** (factures, avoirs), immuables | Facture 650 € le 20/01 |
| **Encaissé** | Quel argent est réellement entré ou sorti ? | Les **paiements** et **remboursements** | 650 € reçus par carte bancaire le 20/01 |
| **Consommé** | Quel service a réellement été rendu ? | Les **consommations** (présence au cours, expiration d'un droit) | 3 séances en février |
| **Dû** | Qui doit quoi à qui, maintenant ? | **Calculé**, jamais stocké | L'atelier doit encore 7 séances à Nadia |

Et deux horloges différentes, qu'il ne faut pas mélanger :
- **La TVA suit l'argent.** Pour une prestation de services, la TVA est exigible à l'encaissement (sauf option pour les débits). Pour les cartes et bons « univoques », elle est exigible à la vente du bon.
- **Le chiffre d'affaires suit le service.** L'atelier a gagné l'argent quand il a rendu le service, ou quand le droit du client a expiré. Avant cela, l'argent encaissé est une **dette** envers le client (un prépaiement).

---

## 2. Les principes fondateurs

Tous les cas doivent découler de ces principes. C'est ce qui garantit la cohérence que l'énoncé évalue.

| # | Principe |
|---|---|
| **P1** | Les quatre axes (vendu, encaissé, consommé, dû) sont stockés séparément. « Dû » est toujours calculé. |
| **P2** | Un document émis (facture, avoir) est **immuable** et numéroté dans une **séquence continue, sans trou**. Toute correction est un **nouveau document** qui référence l'original. |
| **P3** | La facture est émise **quand la vente devient ferme**. Elle porte l'échéancier si le paiement est échelonné. Les encaissements sont suivis à part et rattachés à la facture (« lettrage »). |
| **P4** | La **TVA collectée suit l'encaissement** (prestations de services), ou la vente du bon (cartes et bons univoques). |
| **P5** | Le **chiffre d'affaires est reconnu quand le service est rendu**. Avant, l'argent encaissé est un prépaiement, c'est-à-dire une dette envers le client. |
| **P6** | Un prépaiement a un type : **en unités** (carte de 10 séances, période d'abonnement) ou **en euros** (bon cadeau). Une hausse de tarif ne change pas un droit en unités, mais réduit ce qu'achète un solde en euros. |
| **P7** | Une somme conservée **sans service rendu**, parce que la prestation n'était pas remboursable (annulation hors délai, droit expiré), devient du chiffre d'affaires à la date prévue du service ou à la date d'expiration. La TVA déjà collectée **n'est pas reversée**. |
| **P8** | Le prix est **figé au moment de la vente**. Un changement de catalogue ne touche jamais une vente passée. |
| **P9** | Une correction est **datée du jour où elle est faite**, jamais antidatée dans une période déjà clôturée. |
| **P10** | Tous les montants sont en **centimes entiers**. HT = arrondi(TTC / 1,2) et TVA = TTC − HT, ce qui garantit un TTC exact au centime. |

---

## 3. Esquisse du modèle de données

```
customers           (payeur ou bénéficiaire ; Julien et Léa sont deux customers distincts)
products            (catalogue, prix courant ; sert uniquement à créer des ventes)
sales               (une vente : produit, prix figé, acheteur, bénéficiaire, date, statut)
entitlements        (droit prépayé : type unités | euros, quantité initiale, restant,
                     valeur unitaire, date d'expiration, bénéficiaire)
consumptions        (service rendu : présence au cours, consommation de droit, expiration)
documents           (facture | avoir ; numéro séquentiel ; date ; client ; référence
                     au document corrigé ; IMMUABLE)
document_lines      (libellé, HT, TVA, TTC ; lignes de déduction des prépaiements)
payments            (encaissement ou remboursement : moyen, montant brut, frais,
                     statut réussi/échoué, identifiant Stripe)
allocations         (lettrage : quel paiement règle quel document, pour quel montant)
ledger_entries      (journal : compte, débit, crédit, date, pièce ; toujours équilibré)
```

Comptes simplifiés pour le journal : `411` clients, `512` banque, `4191` prépaiements et acomptes reçus, `487` produits constatés d'avance, `706` prestations (chiffre d'affaires), `44571` TVA collectée, `627` frais bancaires (commissions Stripe).

---

## 4. Les 12 cas

### C1 — Le cas simple
- **Situation :** cours à l'unité vendu et payé par carte le 12/01, cours suivi le 16/01.
- **Facture** émise le 12/01 (P3) : **75 € TTC = 62,50 € HT + 12,50 € TVA**.
- **TVA exigible** le 12/01, date de l'encaissement (P4).
- **Chiffre d'affaires reconnu** le 16/01, date du cours (P5). Entre le 12 et le 16, les 62,50 € HT sont un prépaiement.
- 💭 Le cas sert à caler la base : un document, un paiement, une consommation, trois dates qui peuvent différer.

### C2 — L'annulation dans les délais
- **Situation :** achat le 05/02 pour un cours le 20/02, annulation le 15/02 (5 jours avant, donc plus de 48 h).
- La facture du 05/02 **n'est pas touchée** (P2).
- **Avoir** le 15/02 : −75 € TTC (−62,50 HT / −12,50 TVA), qui référence la facture.
- **Remboursement** de 75 € sur la carte de la cliente.
- Aucun chiffre d'affaires n'est reconnu. La TVA collectée est annulée par l'avoir.

### C3 — L'annulation hors délai
- **Situation :** annulation le 19/02 au soir pour un cours le 20/02 à 14h (moins de 48 h).
- L'atelier **garde l'argent** (règle du catalogue).
- **Aucun nouveau document.** La réservation passe au statut « annulée hors délai ».
- **Chiffre d'affaires reconnu** le 20/02, date à laquelle le cours aurait eu lieu (P7).
- **TVA :** déjà collectée, elle n'est pas reversée. Le client a payé le prix complet d'une prestation non remboursable : ce ne sont pas des arrhes (qui sont une faculté de dédit), donc la somme conservée est la contrepartie du service mis à sa disposition. C'est la logique des billets d'avion et des cartes de cinéma non utilisés.
- 🟡 Alternative rejetée : la traiter comme une indemnité hors TVA. Ce serait défendable seulement si les CGV parlaient d'arrhes.

### C4 — La carte entamée qu'on veut se faire rembourser
- **Situation :** carte achetée 650 € le 20/01, 3 séances consommées en février, remboursement demandé le 15/03.
- **Facture initiale** du 20/01 : 650 € TTC = **541,67 HT + 108,33 TVA**. TVA due à la vente (la carte est un bon univoque, voir C6).
- ⚠️ Le catalogue ne prévoit **aucun droit au remboursement** de la carte. Rembourser est donc un **geste commercial** : il faut quand même une règle.
- 🟡 **Décision : que valent les 3 séances consommées ?**
  - ⭐ **Option A, 75 € la séance (remise perdue)** : on rend **650 − 3 × 75 = 425 €**. La remise de volume est la contrepartie d'un engagement sur 10 séances : si le client rompt l'engagement, les séances consommées reviennent au **tarif unitaire en vigueur au moment de la consommation**. **Argument décisif : contre l'abus.** Avec l'option B, n'importe quel client aurait intérêt à acheter une carte puis à se faire rembourser le reste, et obtiendrait ainsi 13 % de remise systématique.
  - Option B, 65 € la séance : on rend **650 − 3 × 65 = 455 €**. C'est plus généreux et plus simple à expliquer, mais ouvert à l'abus décrit ci-dessus.
- **Ce qu'on émet** (option A) : un **avoir** le 15/03 de −425 € TTC (−354,17 HT / −70,83 TVA), qui référence la facture du 20/01, et un **remboursement** de 425 €.
- **Chiffre d'affaires final :** 225 € TTC (187,50 HT) : 195 € reconnus au fil des séances de février, plus 30 € le 15/03 au titre de la remise perdue.
- ✅ Vérification : 541,67 − 354,17 = 187,50 HT et 108,33 − 70,83 = 37,50 TVA, soit 225 TTC.

### C5 — La carte qui expire
- **Situation :** carte de 650 € achetée le 03/02/2026, 6 séances consommées, expiration le 03/02/2027 avec 4 séances restantes.
- **Le 03/02/2027 :** la dette restante (4 × 65 = **260 € TTC, soit 216,67 HT**) devient du chiffre d'affaires (P7). La TVA, collectée à la vente, n'est pas reversée. Aucun document n'est émis.
- 💭 À la clôture de l'exercice 2026, les séances non consommées figuraient en produits constatés d'avance.
- **Le 10/02, prolongation d'un mois accordée :**
  - ⭐ On **contre-passe** la reconnaissance du 03/02 : −216,67 HT de chiffre d'affaires, +216,67 de dette envers Karim. Le droit est rouvert jusqu'au 03/03/2027. Il n'y a aucune nouvelle facture, puisqu'il n'y a ni nouvelle vente ni nouvel encaissement.
  - Les séances consommées pendant la prolongation sont reconnues normalement. Si elles expirent de nouveau, on applique P7 une seconde fois.
  - Si la période de février 2027 était déjà clôturée, la contre-passation serait datée du 10/02 (P9).

### C6 — Le bon cadeau à trois personnes
- **Situation :** Julien achète un bon de 150 € le 10/12/2026 pour Léa. Léa l'utilise pour un cours à 75 € le 20/01, puis pour 40 € sur un stage le 15/03. Le solde de 35 € expire le 10/12/2027.
- 🟡 **Décision structurante : quel régime de TVA pour le bon ?**
  - ⭐ **Bon univoque** (TVA due à la vente du bon) : tout le catalogue est à 20 % et en France, donc le taux et le lieu sont connus dès l'émission. C'est le cas que l'administration fiscale classe en bon « à usage unique ».
  - Bon polyvalent : pas de TVA à la vente, TVA due à l'utilisation. C'est obligatoire si l'atelier vend aussi des produits à un autre taux de TVA.
  - 💭 **Insight produit pour Daisy :** avec 70 ateliers, les deux cas existeront. Le régime doit donc être un **paramètre du bon** (`voucher_type`), pas une règle codée en dur.
- **Qui est le client ?**
  - **Julien** est le client de la **vente du bon** : il reçoit la facture et c'est lui qui a payé.
  - **Léa** est la **bénéficiaire** : elle utilise le bon sans qu'aucun document ne soit émis à son nom, puisque tout a déjà été facturé à Julien.
- **Les écritures (bon univoque) :**

| Date | Événement | Document | Chiffre d'affaires | Dette « bon » restante |
|---|---|---|---|---|
| 10/12/2026 | Achat par Julien | Facture 150 € TTC (125 HT / 25 TVA) à Julien | 0 | 150 € |
| 20/01/2027 | Cours de Léa, entièrement payé par le bon | Aucun : le cours était déjà facturé à Julien via le bon | +62,50 HT | 75 € |
| 15/03/2027 | Léa utilise 40 € du bon sur un stage | Aucun pour la part payée par le bon (s'il restait une part à payer, elle serait facturée avec une ligne de déduction du bon, comme en C11) | +33,33 HT | 35 € |
| 10/12/2027 | Expiration du solde | Aucun | +29,17 HT (35 € TTC) | 0 € |

- **Quand l'atelier a-t-il gagné l'argent ?** Il l'a **encaissé** le 10/12/2026, mais il l'a **gagné** en trois fois : le 20/01, le 15/03 et à l'expiration du solde.
- 💭 Simplification assumée : le chiffre d'affaires est reconnu à la date d'utilisation du bon. Pour un stage qui aurait lieu plus tard, il faudrait le reconnaître à la date du stage.
- **Le solde expiré** devient du chiffre d'affaires à l'expiration (P7). Avec un bon polyvalent, il n'y aurait jamais de TVA sur ces 35 €.

### C7 — L'abonnement résilié en cours de mois
- **Situation :** abonnée depuis octobre, prélevée le 5 de chaque mois, résiliation le 18/03.
- La période payée le 05/03 court du **05/03 au 04/04** (facture de 120 € TTC = 100 HT + 20 TVA).
- 🟡 **Décision :**
  - ⭐ **Pas de remboursement au prorata.** « Sans engagement » veut dire sans engagement **pour les mois futurs**, pas remboursement du mois en cours. L'accès reste ouvert jusqu'au 04/04 et il n'y a pas de prélèvement le 05/04. C'est la pratique courante (salles de sport, logiciels).
  - Option : remboursement au prorata (avoir de 120 × 17/31 environ). C'est plus généreux, mais plus complexe, et cela pousse à résilier en milieu de mois.
- **Cours déjà réservés fin mars :** ils sont **maintenus**, puisqu'ils tombent dans la période payée. Ceux réservés après le 04/04 sont annulés automatiquement, avec une proposition de les payer à l'unité.
- **Chiffre d'affaires** reconnu au fil de la période payée, au jour près (ou à chaque cours suivi, au choix, à documenter).

### C8 — L'abonnement dont le prélèvement échoue
- **Situation :** prélèvement du 05/02 en échec, Inès vient à 3 cours entre le 06/02 et le 12/02, puis régularise le 13/02.
- **Une seule facture**, émise le 05/02 (P3) : la vente de la période est ferme, que le paiement réussisse ou non.
- **Deux tentatives de paiement :** une échouée (05/02), une réussie (13/02). Entre les deux, la facture est **due mais non payée** : c'est une créance de 120 €.
- **TVA exigible le 13/02**, date de l'encaissement réel (P4).
- **Les 3 cours** sont des consommations normales.
- 💭 Règle métier sous-jacente : un **délai de grâce** (par exemple 7 jours) pendant lequel l'accès reste ouvert. Inès était dedans. Au-delà, l'accès serait suspendu.
- ❌ Alternative rejetée : n'émettre la facture qu'au paiement réussi. Inès aurait alors suivi des cours sans aucune vente enregistrée, ce qui confond « vendu » et « encaissé ».

### C9 — Le stage payé en deux fois
- **Situation :** stage de 280 € réservé le 10/02 pour les 28/02 et 01/03, acompte de 84 € le 10/02, solde de 196 € le 21/02.
- 🟡 **Décision : combien de documents ?**
  - ⭐ **Option A : une seule facture** de 280 € (233,33 HT / 46,67 TVA), émise le 10/02 avec un **échéancier** (84 € le 10/02, 196 € le 21/02), et **deux encaissements** rattachés. C'est la stricte application de P1 et P3 : la facture dit ce qui est vendu, les paiements disent ce qui est encaissé. C'est le même schéma que C8.
  - Option B : une **facture d'acompte** de 84 € (70 HT / 14 TVA) le 10/02, puis une **facture de solde** de 280 € qui déduit l'acompte, avec 196 € restant à payer (163,33 HT / 32,67 TVA), le 21/02. C'est l'usage courant quand l'encaissement précède la facture.
  - Dans les deux cas, la **TVA est exigible à chaque encaissement** : 14 € le 10/02, puis 32,67 € le 21/02.
- **Chiffre d'affaires** reconnu au stage (28/02 et 01/03).
- **Annulation le 25/02, après paiement complet (J-3) :** le catalogue ne prévoit **aucune règle d'annulation pour les stages**.
  - 🟡 ⭐ Règle proposée, calée sur l'échéancier : **avant J-7, l'acompte est conservé et le reste remboursé ; après J-7, tout est conservé.** Le solde est demandé à J-7 précisément parce qu'après cette date l'atelier ne peut plus remplir la place.
  - Pour une annulation le 25/02 (J-3) : rien n'est remboursé. Le chiffre d'affaires est reconnu à la date du stage (P7), comme en C3.
  - Options alternatives : appliquer la règle des 48 h des cours (remboursement total), ou toujours garder l'acompte et rembourser le solde (avoir de 196 €).
- 💭 Point juridique : le catalogue parle d'« acompte » (engagement ferme), pas d'« arrhes » (faculté de dédit). Entre un professionnel et un consommateur, une somme versée d'avance est présumée être des arrhes, sauf stipulation contraire. Les CGV de l'atelier doivent donc employer le bon mot.

### C10 — L'erreur
- **Situation :** facture F-A émise le 08/02 pour **750 €** au lieu de 75 €. Le client a payé 75 €. L'erreur est repérée le 22/02, après la clôture mensuelle.
- **Ce que fait le système :**
  1. **F-A reste telle quelle**, avec ses 750 €. On ne la modifie pas et on ne la supprime pas : la numérotation doit rester continue et la période est clôturée (P2, P9).
  2. **Avoir AV-B** le 22/02 de **−750 € TTC**, qui référence F-A et annule entièrement l'erreur.
  3. **Nouvelle facture F-C** le 22/02 de **75 € TTC** (62,50 HT / 12,50 TVA), avec la mention de la prestation du 08/02 et la référence à F-A.
  4. **Lettrage :** le paiement de 75 € était rattaché à F-A. Il est **réaffecté** à F-C. F-A est soldée par AV-B (750 − 750 = 0).
- **À la fin : 3 documents**, tous soldés à 0. F-A affiche 750 € et est annulée par AV-B ; AV-B affiche −750 € ; F-C affiche 75 € et a été payée.
- 🟡 Alternative : un avoir partiel de −675 € (2 documents). C'est plus court, mais le client garde une facture « 750 € » corrigée par un « −675 € », ce qui est moins lisible. ⭐ Je retiens les 3 documents.
- 💡 **Insight TVA :** pour une prestation de services, la TVA est exigible à l'encaissement. Comme seuls 75 € ont été encaissés, seuls 12,50 € de TVA ont été collectés. L'erreur de facturation **n'a jamais créé de TVA fantôme** (sauf si l'atelier a opté pour la TVA sur les débits). C'est un bon argument pour montrer pourquoi on sépare vendu et encaissé.
- **Pourquoi « on la modifie » est faux :** inaltérabilité de la facture, numérotation continue sans trou, piste d'audit, et la période est clôturée : la comptabilité déjà arrêtée ne doit plus bouger. Ce qui était faux à une date doit rester visible comme tel, et la correction doit apparaître à sa propre date.

### C11 — Le mélange
- **Situation :** le 15/03, Théo paie un cours de 75 € avec 50 € de bon cadeau et 25 € en carte bancaire.
- **Une facture** de 75 € TTC, avec deux lignes de règlement :
  - une **déduction du bon n°X : −50 €** (41,67 HT / 8,33 TVA, déjà facturés lors de la vente du bon) ;
  - un **net à payer de 25 €** (20,83 HT / 4,17 TVA), réglé par carte bancaire.
- **Deux affectations de paiement :** 50 € pris sur le solde du bon (non monétaire, aucune nouvelle TVA) et 25 € par carte (encaissement réel, TVA exigible le 15/03).
- **Moyen de paiement ou remise ?** **Ni l'un ni l'autre, au sens strict : c'est un prépaiement déjà facturé**, qu'on impute. Ce n'est surtout **pas une remise** : une remise réduirait la base de TVA et le chiffre d'affaires, alors que quelqu'un a réellement payé ces 50 €. Si le bon était polyvalent, ce serait un pur moyen de paiement, avec de la TVA sur les 75 €.
- 💭 C'est le **même mécanisme** que la déduction d'un acompte : un seul concept de « prépaiement imputé » couvre C6, C9 (option B) et C11.

### C12 — Le rapprochement bancaire
- **Situation :** 4 320 € facturés en mars, 4 187,45 € reçus sur le relevé Stripe. L'écart s'explique par les commissions (1,4 % + 0,25 € par transaction, 87 transactions) et un remboursement de 75 € pour une facture de février.
- **Deux ponts distincts**, parce que vendu ≠ encaissé :
  1. **Du facturé à l'encaissé :** factures émises en mars − factures de mars non encaissées (impayés, échéances futures) + encaissements de factures d'autres mois − parts réglées par bon ou carte prépayée (non monétaires) = encaissements bruts du mois.
  2. **De l'encaissé au virement Stripe :** encaissements bruts − commissions (1,4 % × brut + 87 × 0,25 €) − remboursements (75 €) = montant reçu.
- ⚠️ **Les chiffres de l'énoncé ne se rapprochent pas exactement.** Si on applique les commissions aux 4 320 € : 4 320 − 60,48 − 21,75 − 75 = **4 162,77 €**, contre **4 187,45 €** sur le relevé, soit **24,68 € d'écart**. Pour retrouver le relevé, il faudrait environ 4 345,03 € d'encaissements bruts, donc plus que le facturé. C'est probablement voulu : le facturé du mois n'est pas l'encaissé du mois.
- ⭐ **Ce que montre le système :** un tableau en cascade, ligne à ligne, avec une **dernière ligne « écart non expliqué »** affichée explicitement plutôt que masquée. C'est ce qu'affiche l'interface (`npm run dev`). Une évolution possible : rendre chaque ligne cliquable jusqu'aux transactions concernées.

---

## 5. Les questions du README, déduites des principes

1. **Carte de 10 et hausse de tarif en mars :** les 7 séances restantes restent **7 séances**. La carte est un droit **en unités** (P6), payé 65 € l'unité, et le prix est figé à la vente (P8) : la hausse ne change rien. À l'inverse, un bon cadeau est un droit **en euros** : après la hausse, il achète moins. C'est cohérent avec C4 : la valeur d'une séance n'est requalifiée que si la cliente rompt l'engagement.
2. **Bon cadeau partiellement utilisé, solde expiré :** voir C6. Encaissement et TVA à la vente, chiffre d'affaires à chaque utilisation, solde en chiffre d'affaires à l'expiration, sans reversement de TVA.
3. **Facture avec une erreur de montant :** voir C10. Elle est immuable : avoir total, puis nouvelle facture, puis réaffectation du paiement, le tout daté du jour de la correction.
4. **Comment tester :**
   - **Un test par cas** (C1 à C12, au minimum C4, C6, C9 et C10) : on rejoue une séquence d'événements et on vérifie les documents, les montants HT/TVA/TTC, le chiffre d'affaires reconnu et les soldes.
   - **Des invariants vérifiés après chaque opération :** HT + TVA = TTC sur chaque ligne ; numérotation continue et sans doublon ; un avoir ne dépasse jamais le document qu'il corrige ; le journal est équilibré (débits = crédits) ; encaissé net = chiffre d'affaires reconnu + prépaiements restants − créances.
   - **Du test par propriétés** (avec `fast-check`) : des séquences aléatoires de ventes, paiements, consommations, annulations et expirations, après lesquelles les invariants doivent toujours tenir.

---

## 6. Décisions retenues (validées le 15/11, 11:31)

| # | Décision | ✅ Règle retenue | Alternative écartée |
|---|---|---|---|
| D1 | Régime de TVA du bon cadeau | **Bon univoque : TVA à la vente.** Seul ce régime est implémenté. Le modèle porte un champ `vat_regime` pour accueillir le régime polyvalent plus tard, mais celui-ci n'est pas codé (voir plus bas). | Implémenter aussi le régime polyvalent |
| D2 | C4 : valeur des séances consommées | **75 € la séance → 425 € remboursés.** Si la cliente rompt l'engagement de 10 séances, elle perd la remise de volume. | 65 € → 455 € |
| D3 | C9 : annulation d'un stage | **Jusqu'à J-7 : tout est remboursé sauf l'acompte. Après J-7 : rien n'est remboursé.** | Règle des 48 h des cours |
| D4 | C9 : nombre de documents | **1 seule facture** avec échéancier, et 2 encaissements | Facture d'acompte + facture de solde |
| D5 | C7 : résiliation d'abonnement | **Pas de prorata.** L'accès est maintenu jusqu'à la fin de la période payée (04/04) et les cours réservés dans cette période sont honorés. | Remboursement au prorata |
| D6 | C10 : correction | **3 documents :** facture F-A +750 €, avoir AV-B −750 €, nouvelle facture F-C +75 € | Avoir partiel de −675 € |
| D7 | C3 : somme conservée | **Chiffre d'affaires soumis à TVA** | Indemnité hors TVA |
| D8 | C5 : prolongation après expiration | **Pas de nouvelle facture : on prolonge la même carte** et on annule la reconnaissance du chiffre d'affaires faite à l'expiration | Séances offertes en geste commercial |

### Hors périmètre volontaire : le bon cadeau polyvalent
- **Pourquoi je ne le traite pas :** aucun des 12 cas n'en a besoin, puisque tout le catalogue de Terre & Feu est à 20 %. Le coder doublerait les chemins de calcul de C6 et C11, ainsi que leurs tests, sans rien apporter au rendu.
- **Pourquoi il existera dans Daisy :** un atelier qui vend aussi des produits à un autre taux de TVA (un livre à 5,5 %, par exemple) émet des bons polyvalents.
- **Comment je m'y prendrais :** le champ `vat_regime` est déjà dans le modèle. Avec le régime polyvalent, la vente du bon produit un **reçu sans TVA** au lieu d'une facture, et chaque utilisation produit une facture avec TVA sur le prix complet, le bon devenant un simple moyen de paiement. Un solde expiré ne porte jamais de TVA.

## 7. Points d'incertitude assumés
- Les points de TVA (bons, sommes conservées, acomptes) suivent la doctrine publique, mais leur application à un cas réel mérite **l'avis d'un expert-comptable**.
- Les obligations de facturation envers les particuliers et la facture électronique obligatoire (calendrier 2026-2027) sont **hors périmètre** de l'exercice.
- Le C12 tel qu'il est donné ne se rapproche pas au centime : je l'assume et je le montre, au lieu de bricoler un calcul pour tomber juste.

## Sources consultées
- Bons et TVA, article 256 ter du CGI : BOFiP BOI-TVA-CHAMP-10-10-40-50 ; https://bofip.impots.gouv.fr/node/351179 ; https://www.legifiscal.fr/tva/tva-francaise/operations-imposables-exonerees/bons-regles-tva.html
- TVA sur les acomptes et exigibilité à l'encaissement : https://www.legifiscal.fr/actualites-fiscales/3340-exigibilite-tva-acomptes-livraisons-biens-precisions-bofip.html ; https://www.legifiscal.fr/jurisprudences-fiscales/696-exigibilite-tva-acomptes-prestation-service.html
- Immuabilité de la facture, avoirs et numérotation (article 242 nonies A de l'annexe II du CGI) : https://abby.fr/guide/facturation/modifier-une-facture ; https://www.swim.legal/blog/annuler-modifier-facture
- Sommes conservées, arrhes et TVA : https://www.tourmag.com/Indemnites-No-show-fees-et-arrhes-quels-bons-reflexes-a-avoir-en-matiere-de-TVA-ABO_a126890.html ; https://blog.avocats.deloitte.fr/tva-billets-davions-non-utilises/ ; https://www.legifiscal.fr/creation-entreprise/facturation-obligations/facturation-electronique-cas-n24-arrhes.html
