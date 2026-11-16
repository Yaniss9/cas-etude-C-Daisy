import { hoursBetween } from "@/domain/dates";
import { findEntitlement, recordConsumption, remainingQuantity } from "@/domain/entitlements";
import { findInvoiceForSale, issueCreditNote } from "@/domain/invoicing";
import { findSale } from "@/domain/ledger";
import type { Ledger } from "@/domain/ledger";
import { recordRefund } from "@/domain/payments";

const FREE_CANCELLATION_HOURS = 48

export function isCancelledInTime(classStartsAt: string, cancelledAt: string): boolean {
    return hoursBetween(cancelledAt, classStartsAt) >= FREE_CANCELLATION_HOURS
}

export function cancelSingleClass(ledger: Ledger, entitlementId: string, classStartsAt: string, cancelledAt: string): Ledger {
    const entitlement = findEntitlement(ledger, entitlementId)
    const remaining = remainingQuantity(ledger, entitlementId)
    if (!isCancelledInTime(classStartsAt, cancelledAt)) {
        return recordConsumption(ledger, {
            id: `late_${entitlementId}`,
            entitlementId,
            kind: "late_cancellation",
            quantity: remaining,
            occurredAt: classStartsAt.slice(0, 10),
        })
    }
    const sale = findSale(ledger, entitlement.saleId)
    const cancelledOn = cancelledAt.slice(0, 10)
    const invoice = findInvoiceForSale(ledger, sale.id)
    const withCreditNote = issueCreditNote(ledger, invoice.number, sale.grossCents, cancelledOn)
    const withRefund = recordRefund(withCreditNote, sale.id, sale.grossCents, cancelledOn)
    return recordConsumption(withRefund, {
        id: `cancel_${entitlementId}`,
        entitlementId,
        kind: "refunded",
        quantity: remaining,
        occurredAt: cancelledOn,
    })
}
