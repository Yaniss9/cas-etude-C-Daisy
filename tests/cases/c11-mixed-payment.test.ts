import { describe, expect, it } from "vitest";
import { grantEntitlement, remainingQuantity } from "@/domain/entitlements";
import { issueInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import type { Ledger } from "@/domain/ledger";
import { sellWithVoucher } from "@/domain/mixed-payment";
import { amountDue, documentTotal, recordPayment } from "@/domain/payments";
import type { Sale } from "@/domain/types";

const voucherSale: Sale = {
  id: "sale_voucher_theo",
  productKind: "gift_voucher",
  buyerId: "marie",
  beneficiaryId: "theo",
  grossCents: 5000,
  soldAt: "2026-01-10",
};

const theoClass: Sale = {
  id: "sale_c11",
  productKind: "single_class",
  buyerId: "theo",
  beneficiaryId: "theo",
  grossCents: 7500,
  soldAt: "2026-03-15",
};

function theoHoldsA50EuroVoucher(): Ledger {
  const sold = addSale(createEmptyLedger(), voucherSale);
  const invoiced = issueInvoice(sold, voucherSale, "Bon cadeau");
  return grantEntitlement(invoiced, {
    id: "ent_voucher_theo",
    saleId: "sale_voucher_theo",
    unit: "euro",
    initialQuantity: 5000,
    unitValueCents: 1,
    expiresAt: "2027-01-10",
  });
}

function theoPaysWithVoucherAndCard(): Ledger {
  const sold = sellWithVoucher(theoHoldsA50EuroVoucher(), theoClass, "ent_voucher_theo", 5000, "Cours à l'unité");
  return recordPayment(sold, {
    id: "pay_c11",
    saleId: "sale_c11",
    kind: "payment",
    status: "succeeded",
    method: "card",
    amountCents: 2500,
    feeCents: 60,
    paidAt: "2026-03-15",
  });
}

describe("C11 — a 75 € class paid with a 50 € voucher and 25 € by card", () => {
  it("shows the full price, then deducts the voucher as an already-invoiced prepayment", () => {
    const invoice = theoPaysWithVoucherAndCard().documents[1];

    expect(invoice?.lines).toEqual([
      { label: "Cours à l'unité", amounts: { net: 6250, vat: 1250, gross: 7500 } },
      { label: "Bon cadeau F-0001 (déjà facturé)", amounts: { net: -4167, vat: -833, gross: -5000 } },
    ]);
  });

  it("charges VAT only on the 25 € paid by card, the voucher's VAT was charged at its sale", () => {
    const invoice = theoPaysWithVoucherAndCard().documents[1];
    const vat = invoice?.lines.reduce((sum, line) => sum + line.amounts.vat, 0);

    expect(invoice && documentTotal(invoice)).toBe(2500);
    expect(vat).toBe(417);
  });

  it("uses up the voucher and leaves nothing due", () => {
    const ledger = theoPaysWithVoucherAndCard();

    expect(remainingQuantity(ledger, "ent_voucher_theo")).toBe(0);
    expect(amountDue(ledger, "sale_c11")).toBe(0);
  });

  it("issues no new invoice when the voucher covers the whole price (as in C6)", () => {
    const fullyCovered: Sale = { ...theoClass, id: "sale_covered", grossCents: 5000 };
    const after = sellWithVoucher(theoHoldsA50EuroVoucher(), fullyCovered, "ent_voucher_theo", 5000, "Cours");

    expect(after.documents.length).toBe(1);
    expect(remainingQuantity(after, "ent_voucher_theo")).toBe(0);
  });

  it("refuses a voucher amount larger than the price", () => {
    expect(() =>
      sellWithVoucher(theoHoldsA50EuroVoucher(), { ...theoClass, grossCents: 4000 }, "ent_voucher_theo", 5000, "Cours"),
    ).toThrow("Voucher amount exceeds the price of sale sale_c11");
  });
});
