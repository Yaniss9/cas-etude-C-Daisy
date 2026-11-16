import { describe, expect, it } from "vitest";
import { issueInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import { amountDue, recordPayment } from "@/domain/payments";
import { accessEndsOn, canBookAfterTermination } from "@/domain/subscription";
import type { Sale } from "@/domain/types";

const LAST_BILLED_ON = "2026-03-05";

const marchSubscription: Sale = {
  id: "sale_c7_march",
  productKind: "subscription",
  buyerId: "ines",
  beneficiaryId: "ines",
  grossCents: 12000,
  soldAt: LAST_BILLED_ON,
};

describe("C7 — subscription billed on the 5th, terminated on 18/03", () => {
  it("keeps access until the end of the paid period: 04/04", () => {
    expect(accessEndsOn(LAST_BILLED_ON)).toBe("2026-04-04");
  });

  it("honours the classes already booked for the end of March", () => {
    expect(canBookAfterTermination(LAST_BILLED_ON, "2026-03-28")).toBe(true);
    expect(canBookAfterTermination(LAST_BILLED_ON, "2026-04-04")).toBe(true);
  });

  it("refuses classes after the paid period", () => {
    expect(canBookAfterTermination(LAST_BILLED_ON, "2026-04-05")).toBe(false);
  });

  it("refunds nothing: the March invoice stays paid, with no credit note", () => {
    const sold = addSale(createEmptyLedger(), marchSubscription);
    const invoiced = issueInvoice(sold, marchSubscription, "Abonnement Libre accès — mars");
    const paid = recordPayment(invoiced, {
      id: "pay_c7_march",
      saleId: "sale_c7_march",
      kind: "payment",
      status: "succeeded",
      method: "sepa",
      amountCents: 12000,
      feeCents: 0,
      paidAt: LAST_BILLED_ON,
    });

    expect(paid.documents.map((document) => document.kind)).toEqual(["invoice"]);
    expect(amountDue(paid, "sale_c7_march")).toBe(0);
  });
});
