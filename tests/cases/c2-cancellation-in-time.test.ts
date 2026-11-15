import { describe, expect, it } from "vitest";
import { issueCreditNote, issueInvoice, nextInvoiceNumber } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import type { Sale } from "@/domain/types";

const sofiaSale: Sale = {
  id: "sale_c2",
  productKind: "single_class",
  buyerId: "sofia",
  beneficiaryId: "sofia",
  grossCents: 7500,
  soldAt: "2026-02-05",
};

function sofiaLedgerWithInvoice() {
  const ledger = addSale(createEmptyLedger(), sofiaSale);
  return issueInvoice(ledger, sofiaSale, "Cours à l'unité");
}

describe("C2 — class bought on 05/02 for 20/02, cancelled on 15/02", () => {
  it("keeps the original invoice unchanged", () => {
    const before = sofiaLedgerWithInvoice();
    const after = issueCreditNote(before, "F-0001", 7500, "2026-02-15");

    expect(after.documents[0]).toEqual(before.documents[0]);
  });

  it("issues a credit note of -75 € that refers to the invoice", () => {
    const after = issueCreditNote(sofiaLedgerWithInvoice(), "F-0001", 7500, "2026-02-15");

    expect(after.documents[1]).toEqual({
      number: "AV-0001",
      kind: "credit_note",
      issuedAt: "2026-02-15",
      customerId: "sofia",
      saleId: "sale_c2",
      correctsNumber: "F-0001",
      lines: [
        {
          label: "Annulation de la facture F-0001",
          amounts: { net: -6250, vat: -1250, gross: -7500 },
        },
      ],
    });
  });

  it("brings the total billed for the sale back to zero", () => {
    const after = issueCreditNote(sofiaLedgerWithInvoice(), "F-0001", 7500, "2026-02-15");
    const total = after.documents
      .flatMap((document) => document.lines)
      .reduce((sum, line) => sum + line.amounts.gross, 0);

    expect(total).toBe(0);
  });

  it("refuses to cancel an invoice that does not exist", () => {
    expect(() =>
      issueCreditNote(sofiaLedgerWithInvoice(), "F-9999", 7500, "2026-02-15"),
    ).toThrow("Invoice F-9999 not found");
  });

  it("does not use an invoice number for the credit note", () => {
    const after = issueCreditNote(sofiaLedgerWithInvoice(), "F-0001", 7500, "2026-02-15");

    expect(nextInvoiceNumber(after)).toBe("F-0002");
  });
});
