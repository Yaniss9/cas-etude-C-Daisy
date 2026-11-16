import { describe, expect, it } from "vitest";
import { explainPayout } from "@/domain/reconciliation";

describe("C12 — March: 4 320 € invoiced, 4 187,45 € received from Stripe", () => {
  const march = explainPayout({
    invoicedCents: 432000,
    refundedCents: 7500,
    transactionCount: 87,
    percentFeeBasisPoints: 140,
    fixedFeeCents: 25,
    receivedCents: 418745,
  });

  it("explains the gap line by line, without a calculator", () => {
    expect(march.lines).toEqual([
      { label: "Factures émises sur la période", cents: 432000 },
      { label: "Remboursements versés", cents: -7500 },
      { label: "Commissions Stripe (pourcentage)", cents: -6048 },
      { label: "Frais fixes Stripe (87 transactions)", cents: -2175 },
    ]);
    expect(march.expectedCents).toBe(416277);
  });

  it("shows the 24,68 € that the statement's figures do not explain, instead of hiding it", () => {
    expect(march.unexplainedCents).toBe(2468);
  });

  it("leaves nothing unexplained when the figures match", () => {
    const perfect = explainPayout({
      invoicedCents: 10000,
      refundedCents: 0,
      transactionCount: 1,
      percentFeeBasisPoints: 140,
      fixedFeeCents: 25,
      receivedCents: 9835,
    });

    expect(perfect.unexplainedCents).toBe(0);
  });
});
