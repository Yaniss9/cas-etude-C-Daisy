import type { Ledger } from "@/domain/ledger";
import type { BillingDocument, Payment } from "@/domain/types";


export function recordPayment(ledger: Ledger, payment: Payment): Ledger {
    const newLedger = {...ledger, payments: [...ledger.payments, payment]}
    return newLedger
}

export function documentTotal(document: BillingDocument): number {
    const sumGross = document.lines.reduce((sum, line) => sum + line.amounts.gross, 0)
    return sumGross
}

export function totalBilled(ledger: Ledger, saleId: string): number {
    const documents = ledger.documents.filter((document) => document.saleId === saleId)
    return documents.reduce((sum, document) => sum + documentTotal(document), 0)
}

export function totalPaid(ledger: Ledger, saleId: string): number {
    const payments = ledger.payments
    .filter((payment) => payment.saleId === saleId && payment.status === "succeeded")
    return payments.reduce((sum, payment) => sum + payment.amountCents, 0)
}

export function amountDue(ledger: Ledger, saleId: string): number {
    return totalBilled(ledger, saleId) - totalPaid(ledger, saleId)
}