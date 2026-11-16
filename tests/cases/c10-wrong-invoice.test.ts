import { describe, expect, it } from "vitest";
import { correctInvoice, createInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import { amountDue, recordPayment } from "@/domain/payments";
import type { Sale } from "@/domain/types";

const sale: Sale = {
  id: "sale_c10",
  productKind: "single_class",
  buyerId: "client_c10",
  beneficiaryId: "client_c10",
  grossCents: 7500,
  soldAt: "2026-02-08",
};

function ledgerWithWrongInvoice() {
  const withSale = addSale(createEmptyLedger(), sale);
  const withWrongInvoice = createInvoice(withSale, {
    saleId: "sale_c10",
    customerId: "client_c10",
    issuedAt: "2026-02-08",
    label: "Cours à l'unité",
    grossCents: 75000,
  });
  return recordPayment(withWrongInvoice, {
    id: "pay_c10",
    saleId: "sale_c10",
    kind: "payment",
    status: "succeeded",
    method: "card",
    amountCents: 7500,
    feeCents: 130,
    paidAt: "2026-02-08",
  });
}

describe("C10 — invoice of 750 € instead of 75 €, corrected on 22/02", () => {
  it("before the correction, wrongly shows 675 € still due", () => {
    expect(amountDue(ledgerWithWrongInvoice(), "sale_c10")).toBe(67500);
  });

  it("ends with 3 documents: the wrong invoice, its credit note, the right invoice", () => {
    const after = correctInvoice(ledgerWithWrongInvoice(), "F-0001", 7500, "2026-02-22", "Cours à l'unité");

    expect(after.documents).toEqual([
      {
        number: "F-0001",
        kind: "invoice",
        issuedAt: "2026-02-08",
        customerId: "client_c10",
        saleId: "sale_c10",
        lines: [{ label: "Cours à l'unité", amounts: { net: 62500, vat: 12500, gross: 75000 } }],
      },
      {
        number: "AV-0001",
        kind: "credit_note",
        issuedAt: "2026-02-22",
        customerId: "client_c10",
        saleId: "sale_c10",
        correctsNumber: "F-0001",
        lines: [
          {
            label: "Annulation de la facture F-0001",
            amounts: { net: -62500, vat: -12500, gross: -75000 },
          },
        ],
      },
      {
        number: "F-0002",
        kind: "invoice",
        issuedAt: "2026-02-22",
        customerId: "client_c10",
        saleId: "sale_c10",
        lines: [{ label: "Cours à l'unité", amounts: { net: 6250, vat: 1250, gross: 7500 } }],
      },
    ]);
  });

  it("leaves nothing due, without moving the payment", () => {
    const before = ledgerWithWrongInvoice();
    const after = correctInvoice(before, "F-0001", 7500, "2026-02-22", "Cours à l'unité");

    expect(amountDue(after, "sale_c10")).toBe(0);
    expect(after.payments).toEqual(before.payments);
  });

  it("refuses to correct an invoice that does not exist", () => {
    expect(() =>
      correctInvoice(ledgerWithWrongInvoice(), "F-9999", 7500, "2026-02-22", "Cours à l'unité"),
    ).toThrow("Invoice F-9999 not found");
  });
});
