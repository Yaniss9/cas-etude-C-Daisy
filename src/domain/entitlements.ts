import type { Ledger } from "@/domain/ledger";
import { splitVat } from "@/domain/money";
import type { VatBreakdown } from "@/domain/money";
import type { Consumption, Entitlement } from "@/domain/types";

export type RevenueEvent = { date: string; kind: Consumption["kind"]; amounts: VatBreakdown }

export function grantEntitlement(ledger: Ledger, entitlement: Entitlement): Ledger {
    const newLedger = {...ledger, entitlements: [...ledger.entitlements, entitlement]}
    return newLedger
}

export function findEntitlement(ledger: Ledger, entitlementId: string): Entitlement {
    const entitlement = ledger.entitlements.find((item) => item.id === entitlementId)
    if (entitlement === undefined) {
        throw new Error(`Entitlement ${entitlementId} not found`)
    }
    return entitlement
}

export function remainingQuantity(ledger: Ledger, entitlementId: string): number {
    const entitlement = findEntitlement(ledger, entitlementId)
    const consumed = ledger.consumptions
        .filter((consumption) => consumption.entitlementId === entitlementId)
        .reduce((sum, consumption) => sum + consumption.quantity, 0)
    return entitlement.initialQuantity - consumed
}

export function recordConsumption(ledger: Ledger, consumption: Consumption): Ledger {
    const remaining = remainingQuantity(ledger, consumption.entitlementId)
    if (consumption.quantity > remaining) {
        throw new Error(`Not enough remaining on entitlement ${consumption.entitlementId}`)
    }
    const newLedger = {...ledger, consumptions: [...ledger.consumptions, consumption]}
    return newLedger
}

export function redeemVoucher(ledger: Ledger, entitlementId: string, amountCents: number, usedAt: string): Ledger {
    const entitlement = findEntitlement(ledger, entitlementId)
    if (entitlement.unit !== "euro") {
        throw new Error(`Entitlement ${entitlementId} is not a gift voucher`)
    }
    return recordConsumption(ledger, {
        id: `redeem_${entitlementId}_${ledger.consumptions.length + 1}`,
        entitlementId,
        kind: "redeemed",
        quantity: amountCents,
        occurredAt: usedAt,
    })
}

export function expireEntitlement(ledger: Ledger, entitlementId: string, expiredOn: string): Ledger {
    const remaining = remainingQuantity(ledger, entitlementId)
    if (remaining === 0) {
        return ledger
    }
    return recordConsumption(ledger, {
        id: `expire_${entitlementId}`,
        entitlementId,
        kind: "expired",
        quantity: remaining,
        occurredAt: expiredOn,
    })
}

export function earnedRevenue(ledger: Ledger, entitlementId: string): RevenueEvent[] {
    const entitlement = findEntitlement(ledger, entitlementId)
    return ledger.consumptions
        .filter((consumption) => consumption.entitlementId === entitlementId && consumption.kind !== "refunded")
        .map((consumption) => ({
            date: consumption.occurredAt,
            kind: consumption.kind,
            amounts: splitVat(consumption.quantity * entitlement.unitValueCents),
        }))
}
