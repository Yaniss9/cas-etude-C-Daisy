import { describe, expect, it } from "vitest";
import {
  earnedRevenue,
  expireEntitlement,
  extendEntitlement,
  findEntitlement,
  grantEntitlement,
  recordConsumption,
  remainingQuantity,
} from "@/domain/entitlements";
import { createEmptyLedger } from "@/domain/ledger";
import type { Ledger } from "@/domain/ledger";

function karimAfterSixClasses(): Ledger {
  let ledger = grantEntitlement(createEmptyLedger(), {
    id: "ent_c5",
    saleId: "sale_c5",
    unit: "class",
    initialQuantity: 10,
    unitValueCents: 6500,
    expiresAt: "2027-02-03",
  });
  for (let index = 1; index <= 6; index++) {
    ledger = recordConsumption(ledger, {
      id: `class_${index}`,
      entitlementId: "ent_c5",
      kind: "attended",
      quantity: 1,
      occurredAt: `2026-0${index + 2}-10`,
    });
  }
  return ledger;
}

function expiredOn3February(): Ledger {
  return expireEntitlement(karimAfterSixClasses(), "ent_c5", "2027-02-03");
}

function sumEarned(ledger: Ledger): number {
  return earnedRevenue(ledger, "ent_c5").reduce((sum, event) => sum + event.amounts.gross, 0);
}

describe("C5 — 10-class card bought on 03/02/2026, 6 used, expires on 03/02/2027", () => {
  it("earns the 4 unused classes (4 × 65 € = 260 €) on the expiry date", () => {
    const events = earnedRevenue(expiredOn3February(), "ent_c5");

    expect(events.at(-1)).toEqual({
      date: "2027-02-03",
      kind: "expired",
      amounts: { net: 21667, vat: 4333, gross: 26000 },
    });
    expect(remainingQuantity(expiredOn3February(), "ent_c5")).toBe(0);
  });
});

describe("C5 — Karim complains on 10/02, the studio extends the card by one month", () => {
  it("gives the 4 classes back, until 03/03/2027, without any new invoice", () => {
    const extended = extendEntitlement(expiredOn3February(), "ent_c5", "2027-03-03", "2027-02-10");

    expect(remainingQuantity(extended, "ent_c5")).toBe(4);
    expect(findEntitlement(extended, "ent_c5").expiresAt).toBe("2027-03-03");
    expect(extended.documents).toEqual([]);
  });

  it("reverses the 260 € earned at expiry: only the 6 classes used remain earned", () => {
    const extended = extendEntitlement(expiredOn3February(), "ent_c5", "2027-03-03", "2027-02-10");

    expect(sumEarned(expiredOn3February())).toBe(65000);
    expect(sumEarned(extended)).toBe(39000);
  });

  it("refuses to extend a card that has not expired", () => {
    expect(() => extendEntitlement(karimAfterSixClasses(), "ent_c5", "2027-03-03", "2027-02-10")).toThrow(
      "Entitlement ent_c5 has not expired",
    );
  });
});
