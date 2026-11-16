import { describe, expect, it } from "vitest";
import { refundClassCard } from "@/domain/class-card";
import { grantEntitlement, recordConsumption, remainingQuantity } from "@/domain/entitlements";
import { issueInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import { amountDue, recordPayment, totalBilled, totalPaid } from "@/domain/payments";
import type { Ledger } from "@/domain/ledger";
import type { Sale } from "@/domain/types";

const SINGLE_CLASS_PRICE_CENTS = 7500;

const nadiaSale: Sale = {
  id: "sale_c4",
  productKind: "class_card",
  buyerId: "nadia",
  beneficiaryId: "nadia",
  grossCents: 65000,
  soldAt: "2026-01-20",
};

function nadiaWithClasses(classCount: number): Ledger {
  const sold = addSale(createEmptyLedger(), nadiaSale);
  const invoiced = issueInvoice(sold, nadiaSale, "Carte 10 séances");
  const paid = recordPayment(invoiced, {
    id: "pay_c4",
    saleId: "sale_c4",
    kind: "payment",
    status: "succeeded",
    method: "card",
    amountCents: 65000,
    feeCents: 935,
    paidAt: "2026-01-20",
  });
  let ledger = grantEntitlement(paid, {
    id: "ent_c4",
    saleId: "sale_c4",
    unit: "class",
    initialQuantity: 10,
    unitValueCents: 6500,
    expiresAt: "2027-01-20",
  });
  for (let index = 1; index <= classCount; index++) {
    ledger = recordConsumption(ledger, {
      id: `class_${index}`,
      entitlementId: "ent_c4",
      kind: "attended",
      quantity: 1,
      occurredAt: `2026-02-${String(index).padStart(2, "0")}`,
    });
  }
  return ledger;
}

describe("C4 — 10-class card (650 €), 3 classes used, refund asked on 15/03", () => {
  it("refunds 425 €: the 3 classes used are charged at the single price (650 - 3 × 75)", () => {
    const after = refundClassCard(nadiaWithClasses(3), "ent_c4", SINGLE_CLASS_PRICE_CENTS, "2026-03-15");

    expect(after.payments.at(-1)?.amountCents).toBe(-42500);
  });

  it("keeps the original invoice and issues a partial credit note of -425 €", () => {
    const before = nadiaWithClasses(3);
    const after = refundClassCard(before, "ent_c4", SINGLE_CLASS_PRICE_CENTS, "2026-03-15");

    expect(after.documents[0]).toEqual(before.documents[0]);
    expect(after.documents[1]).toEqual({
      number: "AV-0001",
      kind: "credit_note",
      issuedAt: "2026-03-15",
      customerId: "nadia",
      saleId: "sale_c4",
      correctsNumber: "F-0001",
      lines: [
        {
          label: "Remboursement du solde de la carte (7 séances non utilisées)",
          amounts: { net: -35417, vat: -7083, gross: -42500 },
        },
      ],
    });
  });

  it("leaves 225 € billed, 225 € kept and nothing due", () => {
    const after = refundClassCard(nadiaWithClasses(3), "ent_c4", SINGLE_CLASS_PRICE_CENTS, "2026-03-15");

    expect(totalBilled(after, "sale_c4")).toBe(22500);
    expect(totalPaid(after, "sale_c4")).toBe(22500);
    expect(amountDue(after, "sale_c4")).toBe(0);
  });

  it("closes the card: no class can be used after the refund", () => {
    const after = refundClassCard(nadiaWithClasses(3), "ent_c4", SINGLE_CLASS_PRICE_CENTS, "2026-03-15");

    expect(remainingQuantity(after, "ent_c4")).toBe(0);
  });

  it("refuses a refund when the classes used already cost more than the card (9 × 75 > 650)", () => {
    expect(() =>
      refundClassCard(nadiaWithClasses(9), "ent_c4", SINGLE_CLASS_PRICE_CENTS, "2026-03-15"),
    ).toThrow("Nothing to refund on entitlement ent_c4");
  });
});
