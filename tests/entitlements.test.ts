import { describe, expect, it } from "vitest";
import { grantEntitlement, recordConsumption, remainingQuantity } from "@/domain/entitlements";
import { createEmptyLedger } from "@/domain/ledger";
import type { Consumption, Entitlement } from "@/domain/types";

const nadiaCard: Entitlement = {
  id: "ent_c4",
  saleId: "sale_c4",
  unit: "class",
  initialQuantity: 10,
  unitValueCents: 6500,
  expiresAt: "2027-01-20",
};

function attendedClass(id: string, occurredAt: string): Consumption {
  return { id, entitlementId: "ent_c4", kind: "attended", quantity: 1, occurredAt };
}

function nadiaAfterThreeClasses() {
  const granted = grantEntitlement(createEmptyLedger(), nadiaCard);
  const first = recordConsumption(granted, attendedClass("c1", "2026-02-03"));
  const second = recordConsumption(first, attendedClass("c2", "2026-02-10"));
  return recordConsumption(second, attendedClass("c3", "2026-02-17"));
}

describe("grantEntitlement", () => {
  it("adds the entitlement to a new ledger without modifying the original one", () => {
    const before = createEmptyLedger();
    const after = grantEntitlement(before, nadiaCard);

    expect(after.entitlements).toEqual([nadiaCard]);
    expect(before.entitlements.length).toBe(0);
  });
});

describe("remainingQuantity", () => {
  it("is the full card when nothing has been consumed yet", () => {
    const ledger = grantEntitlement(createEmptyLedger(), nadiaCard);

    expect(remainingQuantity(ledger, "ent_c4")).toBe(10);
  });

  it("decreases with each class attended (C4: 3 classes in February)", () => {
    expect(remainingQuantity(nadiaAfterThreeClasses(), "ent_c4")).toBe(7);
  });

  it("refuses an entitlement that does not exist", () => {
    expect(() => remainingQuantity(createEmptyLedger(), "ent_unknown")).toThrow(
      "Entitlement ent_unknown not found",
    );
  });
});

describe("recordConsumption", () => {
  it("records the consumption without modifying the original ledger", () => {
    const before = grantEntitlement(createEmptyLedger(), nadiaCard);
    const after = recordConsumption(before, attendedClass("c1", "2026-02-03"));

    expect(after.consumptions.length).toBe(1);
    expect(before.consumptions.length).toBe(0);
  });

  it("refuses to consume more than what remains on the card", () => {
    const tooMuch: Consumption = { ...attendedClass("c4", "2026-02-24"), quantity: 8 };

    expect(() => recordConsumption(nadiaAfterThreeClasses(), tooMuch)).toThrow(
      "Not enough remaining on entitlement ent_c4",
    );
  });
});
