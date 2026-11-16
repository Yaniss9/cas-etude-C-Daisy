import { findInvoiceForSale, issueCreditNote } from "@/domain/invoicing";
import { findSale } from "@/domain/ledger";
import type { Ledger } from "@/domain/ledger";
import { roundHalfAwayFromZero } from "@/domain/money";
import { recordRefund, totalPaid } from "@/domain/payments";

const DEPOSIT_RATE_PERCENT = 30
const BALANCE_DAYS_BEFORE_START = 7

export type Installment = { dueOn: string; grossCents: number }

export function subtractDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - days)
    return date.toISOString().slice(0, 10)
}

export function depositCents(grossCents: number): number {
    return roundHalfAwayFromZero(grossCents * DEPOSIT_RATE_PERCENT / 100)
}

export function workshopSchedule(grossCents: number, bookedOn: string, startsOn: string): Installment[] {
    const deposit = depositCents(grossCents)
    return [
        { dueOn: bookedOn, grossCents: deposit },
        { dueOn: subtractDays(startsOn, BALANCE_DAYS_BEFORE_START), grossCents: grossCents - deposit },
    ]
}

export function cancelWorkshop(ledger: Ledger, saleId: string, startsOn: string, cancelledAt: string): Ledger {
    const deadline = subtractDays(startsOn, BALANCE_DAYS_BEFORE_START)
    if (cancelledAt > deadline) {
        return ledger
    }
    const sale = findSale(ledger, saleId)
    const deposit = depositCents(sale.grossCents)
    const invoice = findInvoiceForSale(ledger, saleId)
    const label = "Annulation du stage (acompte conservé)"
    const withCreditNote = issueCreditNote(ledger, invoice.number, sale.grossCents - deposit, cancelledAt, label)
    const refundCents = totalPaid(ledger, saleId) - deposit
    if (refundCents <= 0) {
        return withCreditNote
    }
    return recordRefund(withCreditNote, saleId, refundCents, cancelledAt)
}
