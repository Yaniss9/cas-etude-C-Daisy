import { describe, expect, it } from "vitest";
import { earnedRevenue, grantEntitlement, remainingQuantity } from "@/domain/entitlements";
import { issueInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import type { Ledger } from "@/domain/ledger";
import { amountDue, recordPayment, totalPaid } from "@/domain/payments";
import { cancelSingleClass, isCancelledInTime } from "@/domain/single-class";
import type { Sale } from "@/domain/types";

const CLASS_STARTS_AT = "2026-02-20T14:00:00+01:00";

const sofiaSale: Sale = {
  id: "sale_c3",
  productKind: "single_class",
  buyerId: "sofia",
  beneficiaryId: "sofia",
  grossCents: 7500,
  soldAt: "2026-02-05",
};

function sofiaBookedAndPaid(): Ledger {
  const sold = addSale(createEmptyLedger(), sofiaSale);
  const invoiced = issueInvoice(sold, sofiaSale, "Cours à l'unité");
  const paid = recordPayment(invoiced, {
    id: "pay_c3",
    saleId: "sale_c3",
    kind: "payment",
    status: "succeeded",
    method: "card",
    amountCents: 7500,
    feeCents: 130,
    paidAt: "2026-02-05",
  });
  return grantEntitlement(paid, {
    id: "ent_c3",
    saleId: "sale_c3",
    unit: "class",
    initialQuantity: 1,
    unitValueCents: 7500,
    expiresAt: "2026-02-20",
  });
}

describe("48-hour free cancellation rule", () => {
  it("is in time up to exactly 48 hours before the class", () => {
    expect(isCancelledInTime(CLASS_STARTS_AT, "2026-02-18T14:00:00+01:00")).toBe(true);
    expect(isCancelledInTime(CLASS_STARTS_AT, "2026-02-18T14:01:00+01:00")).toBe(false);
  });
});

describe("C3 — class on 20/02 at 14:00, cancelled on 19/02 in the evening", () => {
  it("keeps the money: no new document, no refund", () => {
    const before = sofiaBookedAndPaid();
    const after = cancelSingleClass(before, "ent_c3", CLASS_STARTS_AT, "2026-02-19T20:00:00+01:00");

    expect(after.documents).toEqual(before.documents);
    expect(totalPaid(after, "sale_c3")).toBe(7500);
    expect(amountDue(after, "sale_c3")).toBe(0);
  });

  it("earns the 75 € on the planned class date, VAT already collected", () => {
    const after = cancelSingleClass(sofiaBookedAndPaid(), "ent_c3", CLASS_STARTS_AT, "2026-02-19T20:00:00+01:00");

    expect(earnedRevenue(after, "ent_c3")).toEqual([
      { date: "2026-02-20", kind: "late_cancellation", amounts: { net: 6250, vat: 1250, gross: 7500 } },
    ]);
    expect(remainingQuantity(after, "ent_c3")).toBe(0);
  });
});

describe("C2 through the same rule — cancelled on 15/02, five days before", () => {
  it("issues a credit note, refunds the client and earns nothing", () => {
    const after = cancelSingleClass(sofiaBookedAndPaid(), "ent_c3", CLASS_STARTS_AT, "2026-02-15T10:00:00+01:00");

    expect(after.documents[1]?.kind).toBe("credit_note");
    expect(totalPaid(after, "sale_c3")).toBe(0);
    expect(amountDue(after, "sale_c3")).toBe(0);
    expect(earnedRevenue(after, "ent_c3")).toEqual([]);
  });
});
