import { describe, expect, it } from "vitest";
import { issueInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import type { Ledger } from "@/domain/ledger";
import { amountDue, recordPayment, totalPaid } from "@/domain/payments";
import type { Payment, Sale } from "@/domain/types";

const februarySubscription: Sale = {
  id: "sale_c8",
  productKind: "subscription",
  buyerId: "ines",
  beneficiaryId: "ines",
  grossCents: 12000,
  soldAt: "2026-02-05",
};

function debit(id: string, status: Payment["status"], paidAt: string): Payment {
  return {
    id,
    saleId: "sale_c8",
    kind: "payment",
    status,
    method: "sepa",
    amountCents: 12000,
    feeCents: 0,
    paidAt,
  };
}

function afterFailedDebit(): Ledger {
  const sold = addSale(createEmptyLedger(), februarySubscription);
  const invoiced = issueInvoice(sold, februarySubscription, "Abonnement Libre accès — février");
  return recordPayment(invoiced, debit("debit_0502", "failed", "2026-02-05"));
}

describe("C8 — direct debit of 05/02 fails, Inès still attends classes, pays on 13/02", () => {
  it("issues one single invoice for the period, on 05/02", () => {
    const ledger = afterFailedDebit();

    expect(ledger.documents.length).toBe(1);
    expect(ledger.documents[0]?.issuedAt).toBe("2026-02-05");
  });

  it("shows 120 € due while the debit has failed: the failed payment does not count", () => {
    const ledger = afterFailedDebit();

    expect(totalPaid(ledger, "sale_c8")).toBe(0);
    expect(amountDue(ledger, "sale_c8")).toBe(12000);
  });

  it("settles the invoice on 13/02, with two payment attempts recorded", () => {
    const settled = recordPayment(afterFailedDebit(), debit("debit_1302", "succeeded", "2026-02-13"));

    expect(settled.payments.map((payment) => payment.status)).toEqual(["failed", "succeeded"]);
    expect(amountDue(settled, "sale_c8")).toBe(0);
    expect(settled.documents.length).toBe(1);
  });
});
