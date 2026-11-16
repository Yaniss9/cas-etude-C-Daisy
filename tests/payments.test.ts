import { describe, expect, it } from "vitest";
import { issueCreditNote, issueInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import { amountDue, recordPayment, totalBilled, totalPaid } from "@/domain/payments";
import type { Payment, Sale } from "@/domain/types";

const camilleSale: Sale = {
  id: "sale_c1",
  productKind: "single_class",
  buyerId: "camille",
  beneficiaryId: "camille",
  grossCents: 7500,
  soldAt: "2026-01-12",
};

const camillePayment: Payment = {
  id: "pay_c1",
  saleId: "sale_c1",
  kind: "payment",
  status: "succeeded",
  method: "card",
  amountCents: 7500,
  feeCents: 130,
  paidAt: "2026-01-12",
};

function camilleLedgerWithInvoice() {
  const ledger = addSale(createEmptyLedger(), camilleSale);
  return issueInvoice(ledger, camilleSale, "Cours à l'unité");
}

describe("recordPayment", () => {
  it("adds the payment to a new ledger without modifying the original one", () => {
    const before = camilleLedgerWithInvoice();
    const after = recordPayment(before, camillePayment);

    expect(after.payments).toEqual([camillePayment]);
    expect(before.payments.length).toBe(0);
  });
});

describe("totalBilled", () => {
  it("adds up the invoices of the sale (C1: 75 €)", () => {
    expect(totalBilled(camilleLedgerWithInvoice(), "sale_c1")).toBe(7500);
  });

  it("subtracts the credit notes of the sale (C2: 75 € - 75 €)", () => {
    const cancelled = issueCreditNote(camilleLedgerWithInvoice(), "F-0001", 7500, "2026-01-14");

    expect(totalBilled(cancelled, "sale_c1")).toBe(0);
  });

  it("ignores the documents of other sales", () => {
    expect(totalBilled(camilleLedgerWithInvoice(), "sale_unknown")).toBe(0);
  });
});

describe("totalPaid", () => {
  it("counts succeeded payments", () => {
    const ledger = recordPayment(camilleLedgerWithInvoice(), camillePayment);

    expect(totalPaid(ledger, "sale_c1")).toBe(7500);
  });

  it("ignores failed payments (C8)", () => {
    const failed: Payment = { ...camillePayment, id: "pay_failed", status: "failed" };
    const ledger = recordPayment(camilleLedgerWithInvoice(), failed);

    expect(totalPaid(ledger, "sale_c1")).toBe(0);
  });

  it("subtracts refunds, recorded as negative amounts (C2)", () => {
    const refund: Payment = {
      ...camillePayment,
      id: "pay_refund",
      kind: "refund",
      amountCents: -7500,
      paidAt: "2026-01-14",
    };
    const paid = recordPayment(camilleLedgerWithInvoice(), camillePayment);
    const refunded = recordPayment(paid, refund);

    expect(totalPaid(refunded, "sale_c1")).toBe(0);
  });
});

describe("amountDue", () => {
  it("is what was billed minus what was paid", () => {
    const ledger = camilleLedgerWithInvoice();
    const paid = recordPayment(ledger, camillePayment);

    expect(amountDue(ledger, "sale_c1")).toBe(7500);
    expect(amountDue(paid, "sale_c1")).toBe(0);
  });
});
