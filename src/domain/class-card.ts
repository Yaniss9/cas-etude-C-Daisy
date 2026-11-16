import { findEntitlement, recordConsumption, remainingQuantity } from "@/domain/entitlements";
import { findInvoiceForSale, issueCreditNote } from "@/domain/invoicing";
import { findSale } from "@/domain/ledger";
import type { Ledger } from "@/domain/ledger";
import { recordRefund } from "@/domain/payments";

export function refundClassCard(
    ledger: Ledger,
    entitlementId: string,
    singleClassPriceCents: number,
    refundedAt: string,
): Ledger {
    const entitlement = findEntitlement(ledger, entitlementId)
    const sale = findSale(ledger, entitlement.saleId)
    const remaining = remainingQuantity(ledger, entitlementId)
    const consumed = entitlement.initialQuantity - remaining
    const refundCents = sale.grossCents - consumed * singleClassPriceCents
    if (refundCents <= 0) {
        throw new Error(`Nothing to refund on entitlement ${entitlementId}`)
    }
    const invoice = findInvoiceForSale(ledger, sale.id)
    const label = `Remboursement du solde de la carte (${remaining} séances non utilisées)`
    const withCreditNote = issueCreditNote(ledger, invoice.number, refundCents, refundedAt, label)
    const withRefund = recordRefund(withCreditNote, sale.id, refundCents, refundedAt)
    return recordConsumption(withRefund, {
        id: `close_${entitlementId}`,
        entitlementId,
        kind: "refunded",
        quantity: remaining,
        occurredAt: refundedAt,
    })
}
