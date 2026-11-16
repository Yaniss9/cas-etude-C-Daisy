import type { Sale, Entitlement, BillingDocument, Payment, Consumption } from "@/domain/types"

export type Ledger = {
    readonly sales: readonly Sale[]
    readonly entitlements: readonly Entitlement[]
    readonly documents: readonly BillingDocument[]
    readonly payments: readonly Payment[]
    readonly consumptions: readonly Consumption[]
}

export function createEmptyLedger(): Ledger {
    return {
        sales: [],
        entitlements: [],
        documents: [],
        payments: [],
        consumptions: [],
    }
}

export function findSale(ledger: Ledger, saleId: string): Sale {
    const sale = ledger.sales.find((item) => item.id === saleId)
    if (sale === undefined) {
        throw new Error(`Sale ${saleId} not found`)
    }
    return sale
}

export function addSale(ledger: Ledger, sale: Sale): Ledger {
    const newLedger = {...ledger, sales: [...ledger.sales, sale]}
    return newLedger
}
