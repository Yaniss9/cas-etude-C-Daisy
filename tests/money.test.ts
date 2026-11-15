import { describe, expect, it } from "vitest";
import { roundHalfAwayFromZero, splitVat, toCents } from "@/domain/money";

describe("toCents", () => {
  it("converts whole euros into cents", () => {
    expect(toCents(84)).toBe(8400);
  });

  it("converts euros with decimals into cents", () => {
    expect(toCents(75.5)).toBe(7550);
  });

  it("removes the floating-point error of 1.15 * 100", () => {
    expect(toCents(1.15)).toBe(115);
  });

  it("keeps the sign of a negative amount", () => {
    expect(toCents(-750)).toBe(-75000);
  });
});

describe("roundHalfAwayFromZero", () => {
  it("rounds a negative half away from zero", () => {
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
  });

  it("rounds a positive half away from zero", () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
  });

  it("rounds a negative value below the half towards zero", () => {
    expect(roundHalfAwayFromZero(-2.3)).toBe(-2);
  });

  it("rounds a negative value above the half away from zero", () => {
    expect(roundHalfAwayFromZero(-2.7)).toBe(-3);
  });

  it("does not treat a value ending with 5 as a half", () => {
    expect(roundHalfAwayFromZero(-2.15)).toBe(-2);
  });

  it("keeps zero unchanged", () => {
    expect(roundHalfAwayFromZero(0)).toBe(0);
  });

  it("never returns negative zero", () => {
    expect(roundHalfAwayFromZero(-0.3)).toBe(0);
  });
});

describe("splitVat", () => {
  it("splits a single class (C1: 75 €)", () => {
    expect(splitVat(7500)).toEqual({ net: 6250, vat: 1250, gross: 7500 });
  });

  it("splits a 10-class card (C4: 650 €)", () => {
    expect(splitVat(65000)).toEqual({ net: 54167, vat: 10833, gross: 65000 });
  });

  it("splits a monthly subscription (C7: 120 €)", () => {
    expect(splitVat(12000)).toEqual({ net: 10000, vat: 2000, gross: 12000 });
  });

  it("puts the rounding cent in the VAT, never in the price (10.35 €)", () => {
    expect(splitVat(1035)).toEqual({ net: 863, vat: 172, gross: 1035 });
  });

  it("splits a credit note as the exact opposite of its invoice (75.03 €)", () => {
    expect(splitVat(7503)).toEqual({ net: 6253, vat: 1250, gross: 7503 });
    expect(splitVat(-7503)).toEqual({ net: -6253, vat: -1250, gross: -7503 });
  });

  it("cancels out with its credit note for every amount up to 1 000 €", () => {
    for (let cents = 1; cents <= 100000; cents++) {
      const invoice = splitVat(cents);
      const creditNote = splitVat(-cents);
      expect(invoice.net + creditNote.net).toBe(0);
      expect(invoice.vat + creditNote.vat).toBe(0);
    }
  });

  it("always gives net + vat = gross for every amount up to 1 000 €", () => {
    for (let cents = 0; cents <= 100000; cents++) {
      const { net, vat, gross } = splitVat(cents);
      expect(net + vat).toBe(gross);
    }
  });
});
