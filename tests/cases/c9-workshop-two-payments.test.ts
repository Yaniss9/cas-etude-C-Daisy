import { describe, expect, it } from "vitest";
import { issueInvoice } from "@/domain/invoicing";
import { addSale, createEmptyLedger } from "@/domain/ledger";
import { amountDue, recordPayment, totalBilled, totalPaid } from "@/domain/payments";
import { subtractDays } from "@/domain/dates";
import { cancelWorkshop, workshopSchedule } from "@/domain/workshop";
import type { Ledger } from "@/domain/ledger";
import type { Payment, Sale } from "@/domain/types";

const STARTS_ON = "2026-02-28";

const workshopSale: Sale = {
  id: "sale_c9",
  productKind: "workshop",
  buyerId: "client_c9",
  beneficiaryId: "client_c9",
  grossCents: 28000,
  soldAt: "2026-02-10",
};

function payment(id: string, amountCents: number, paidAt: string): Payment {
  return {
    id,
    saleId: "sale_c9",
    kind: "payment",
    status: "succeeded",
    method: "card",
    amountCents,
    feeCents: 0,
    paidAt,
  };
}

function bookedWithDepositOnly(): Ledger {
  const sold = addSale(createEmptyLedger(), workshopSale);
  const invoiced = issueInvoice(sold, workshopSale, "Stage week-end (28/02 et 01/03)");
  return recordPayment(invoiced, payment("pay_deposit", 8400, "2026-02-10"));
}

function fullyPaid(): Ledger {
  return recordPayment(bookedWithDepositOnly(), payment("pay_balance", 19600, "2026-02-21"));
}

describe("subtractDays", () => {
  it("counts back across months (28/02 minus 7 days = 21/02)", () => {
    expect(subtractDays("2026-02-28", 7)).toBe("2026-02-21");
    expect(subtractDays("2026-03-01", 7)).toBe("2026-02-22");
  });
});

describe("C9 — workshop at 280 €, deposit on 10/02, balance on 21/02", () => {
  it("computes the schedule: 84 € deposit at booking, 196 € balance 7 days before", () => {
    expect(workshopSchedule(28000, "2026-02-10", STARTS_ON)).toEqual([
      { dueOn: "2026-02-10", grossCents: 8400 },
      { dueOn: "2026-02-21", grossCents: 19600 },
    ]);
  });

  it("issues a single invoice of 280 € on the booking date, paid in two payments", () => {
    const ledger = fullyPaid();

    expect(ledger.documents.length).toBe(1);
    expect(ledger.documents[0]?.issuedAt).toBe("2026-02-10");
    expect(ledger.payments.length).toBe(2);
    expect(amountDue(ledger, "sale_c9")).toBe(0);
  });

  it("shows 196 € still due between the deposit and the balance", () => {
    expect(amountDue(bookedWithDepositOnly(), "sale_c9")).toBe(19600);
  });
});

describe("C9 — cancellation rule: up to 7 days before, everything but the deposit is refunded", () => {
  it("cancelled on 25/02 after paying everything (3 days before): nothing is refunded", () => {
    const before = fullyPaid();
    const after = cancelWorkshop(before, "sale_c9", STARTS_ON, "2026-02-25");

    expect(after).toEqual(before);
    expect(totalPaid(after, "sale_c9")).toBe(28000);
  });

  it("cancelled on 21/02, the last day allowed, after paying everything: 196 € refunded", () => {
    const after = cancelWorkshop(fullyPaid(), "sale_c9", STARTS_ON, "2026-02-21");

    expect(totalBilled(after, "sale_c9")).toBe(8400);
    expect(totalPaid(after, "sale_c9")).toBe(8400);
    expect(amountDue(after, "sale_c9")).toBe(0);
    expect(after.payments.at(-1)?.amountCents).toBe(-19600);
  });

  it("cancelled on 15/02 with only the deposit paid: the balance is cancelled, nothing to refund", () => {
    const after = cancelWorkshop(bookedWithDepositOnly(), "sale_c9", STARTS_ON, "2026-02-15");

    expect(after.documents[1]?.lines[0]?.amounts.gross).toBe(-19600);
    expect(after.payments.length).toBe(1);
    expect(amountDue(after, "sale_c9")).toBe(0);
  });
});
