const VAT_RATE_PERCENT = 20
export type VatBreakdown = { net: number; vat: number; gross: number }

export function toCents(euros: number): number {
    const cents = euros * 100
    return Math.round(cents)
}

export function roundHalfAwayFromZero(value: number): number {
    const sign = Math.sign(value)
    const absolute = Math.abs(value)
    const rounded = Math.round(absolute)
    if (rounded === 0) return 0
    return rounded * sign
}

export function splitVat(grossCents: number): VatBreakdown {
    const exactNet = grossCents * 100 / (100 + VAT_RATE_PERCENT)
    const net = roundHalfAwayFromZero(exactNet)
    const vat = grossCents - net
    return { net, vat, gross: grossCents }
}
