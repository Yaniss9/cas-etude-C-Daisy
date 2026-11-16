import { describe, expect, it } from "vitest";
import {
  earnedRevenue,
  expireEntitlement,
  grantEntitlement,
  redeemVoucher,
  remainingQuantity,
} from "@/domain/entitlements";
import { issueInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import { amountDue, recordPayment } from "@/domain/payments";
import type { Ledger } from "@/domain/ledger";
import type { Sale } from "@/domain/types";

const voucherSale: Sale = {
  id: "sale_c6",
  productKind: "gift_voucher",
  buyerId: "julien",
  beneficiaryId: "lea",
  grossCents: 15000,
  soldAt: "2026-12-10",
};

function voucherBoughtByJulien(): Ledger {
  const sold = addSale(createEmptyLedger(), voucherSale);
  const invoiced = issueInvoice(sold, voucherSale, "Bon cadeau");
  const paid = recordPayment(invoiced, {
    id: "pay_c6",
    saleId: "sale_c6",
    kind: "payment",
    status: "succeeded",
    method: "card",
    amountCents: 15000,
    feeCents: 235,
    paidAt: "2026-12-10",
  });
  return grantEntitlement(paid, {
    id: "ent_c6",
    saleId: "sale_c6",
    unit: "euro",
    initialQuantity: 15000,
    unitValueCents: 1,
    expiresAt: "2027-12-10",
  });
}

function usedTwiceByLea(): Ledger {
  const firstUse = redeemVoucher(voucherBoughtByJulien(), "ent_c6", 7500, "2027-01-20");
  return redeemVoucher(firstUse, "ent_c6", 4000, "2027-03-15");
}

describe("C6 — 150 € voucher bought by Julien for Léa", () => {
  it("invoices Julien, the buyer, with VAT at the sale (single-purpose voucher)", () => {
    const invoice = voucherBoughtByJulien().documents[0];

    expect(invoice?.customerId).toBe("julien");
    expect(invoice?.issuedAt).toBe("2026-12-10");
    expect(invoice?.lines[0]?.amounts).toEqual({ net: 12500, vat: 2500, gross: 15000 });
  });

  it("keeps Léa as the beneficiary, with no document in her name", () => {
    const ledger = usedTwiceByLea();

    expect(ledger.sales[0]?.beneficiaryId).toBe("lea");
    expect(ledger.documents.every((document) => document.customerId === "julien")).toBe(true);
    expect(amountDue(ledger, "sale_c6")).toBe(0);
  });

  it("leaves 35 € on the voucher after Léa's two uses (75 € then 40 €)", () => {
    expect(remainingQuantity(usedTwiceByLea(), "ent_c6")).toBe(3500);
  });

  it("refuses a use larger than the balance", () => {
    expect(() => redeemVoucher(usedTwiceByLea(), "ent_c6", 5000, "2027-04-01")).toThrow(
      "Not enough remaining on entitlement ent_c6",
    );
  });

  it("closes the voucher when the 35 € balance expires on 10/12/2027", () => {
    const expired = expireEntitlement(usedTwiceByLea(), "ent_c6", "2027-12-10");

    expect(remainingQuantity(expired, "ent_c6")).toBe(0);
  });

  it("earns the money in three steps: each use, then the expired balance", () => {
    const expired = expireEntitlement(usedTwiceByLea(), "ent_c6", "2027-12-10");

    expect(earnedRevenue(expired, "ent_c6")).toEqual([
      { date: "2027-01-20", kind: "redeemed", amounts: { net: 6250, vat: 1250, gross: 7500 } },
      { date: "2027-03-15", kind: "redeemed", amounts: { net: 3333, vat: 667, gross: 4000 } },
      { date: "2027-12-10", kind: "expired", amounts: { net: 2917, vat: 583, gross: 3500 } },
    ]);
  });

  it("earns, in total, exactly what was cashed: 150 € (125 € net)", () => {
    const expired = expireEntitlement(usedTwiceByLea(), "ent_c6", "2027-12-10");
    const events = earnedRevenue(expired, "ent_c6");

    expect(events.reduce((sum, event) => sum + event.amounts.gross, 0)).toBe(15000);
    expect(events.reduce((sum, event) => sum + event.amounts.net, 0)).toBe(12500);
  });
});
