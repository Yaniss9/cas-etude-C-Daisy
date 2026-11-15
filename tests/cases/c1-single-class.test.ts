import { describe, expect, it } from "vitest";
import { nextInvoiceNumber, issueInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import type { Sale } from "@/domain/types";

const camilleSale: Sale = {
  id: "sale_c1",
  productKind: "single_class",
  buyerId: "camille",
  beneficiaryId: "camille",
  grossCents: 7500,
  soldAt: "2026-01-12",
};

describe("C1 — single class bought on 12/01, attended on 16/01", () => {
  it("issues an invoice of 75 € (62.50 € net + 12.50 € VAT) on the sale date", () => {
    const ledger = addSale(createEmptyLedger(), camilleSale);
    const after = issueInvoice(ledger, camilleSale, "Cours à l'unité");

    expect(after.documents).toEqual([
      {
        number: "F-0001",
        kind: "invoice",
        issuedAt: "2026-01-12",
        customerId: "camille",
        saleId: "sale_c1",
        lines: [
          {
            label: "Cours à l'unité",
            amounts: { net: 6250, vat: 1250, gross: 7500 },
          },
        ],
      },
    ]);
  });

  it("does not modify the original ledger", () => {
    const ledger = addSale(createEmptyLedger(), camilleSale);
    issueInvoice(ledger, camilleSale, "Cours à l'unité");

    expect(ledger.documents.length).toBe(0);
  });
});

describe("nextInvoiceNumber", () => {
  it("starts at F-0001 on an empty ledger", () => {
    expect(nextInvoiceNumber(createEmptyLedger())).toBe("F-0001");
  });

  it("numbers invoices one after another, without gaps", () => {
    const first = issueInvoice(createEmptyLedger(), camilleSale, "Cours");
    const second = issueInvoice(first, camilleSale, "Cours");

    expect(second.documents.map((document) => document.number)).toEqual([
      "F-0001",
      "F-0002",
    ]);
  });
});
