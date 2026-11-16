import type { Ledger } from "@/domain/ledger";
import type { Consumption, Entitlement } from "@/domain/types";

export function grantEntitlement(ledger: Ledger, entitlement: Entitlement): Ledger {
    const newLedger = {...ledger, entitlements: [...ledger.entitlements, entitlement]}
    return newLedger
}

export function remainingQuantity(ledger: Ledger, entitlementId: string): number {
    const entitlement = ledger.entitlements.find((item) => item.id === entitlementId)
    if (entitlement === undefined) {
        throw new Error(`Entitlement ${entitlementId} not found`)
    }
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
