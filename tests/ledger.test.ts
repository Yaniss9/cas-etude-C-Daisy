import { describe, expect, it } from "vitest";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import type { Sale } from "@/domain/types";

const nadiaCardSale: Sale = {
  id: "sale_c4",
  productKind: "class_card",
  buyerId: "nadia",
  beneficiaryId: "nadia",
  grossCents: 65000,
  soldAt: "2026-01-20",
};

describe("createEmptyLedger", () => {
  it("starts with five empty lists", () => {
    const ledger = createEmptyLedger();
    expect(ledger.sales).toEqual([]);
    expect(ledger.entitlements).toEqual([]);
    expect(ledger.documents).toEqual([]);
    expect(ledger.payments).toEqual([]);
    expect(ledger.consumptions).toEqual([]);
  });
});

describe("addSale", () => {
  it("adds the sale to a new ledger without modifying the original one", () => {
    const before = createEmptyLedger();
    const after = addSale(before, nadiaCardSale);

    expect(after.sales).toEqual([nadiaCardSale]);
    expect(before.sales.length).toBe(0);
  });
});
