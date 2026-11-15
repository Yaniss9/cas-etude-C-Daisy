import type { Ledger } from "@/domain/ledger";
import { splitVat } from "@/domain/money";
import type { Sale, BillingDocument } from "@/domain/types";


export function nextInvoiceNumber(ledger: Ledger): string {
    const invoices = ledger.documents.filter((document) => document.kind === "invoice")
    const next = invoices.length + 1
    return `F-${String(next).padStart(4, "0")}`
}

export function issueInvoice(ledger: Ledger, sale: Sale, label: string): Ledger{
    const invoice: BillingDocument = {
        number: nextInvoiceNumber(ledger),
        kind: "invoice",
        issuedAt: sale.soldAt,
        customerId: sale.buyerId,
        saleId: sale.id,
        lines: [{ label, amounts: splitVat(sale.grossCents) }],
    }
    const newLedger = {...ledger, documents: [...ledger.documents, invoice]}
    return newLedger
}

export function nextCreditNoteNumber(ledger: Ledger): string {
    const credits = ledger.documents.filter((document) => document.kind === "credit_note")
    const next = credits.length + 1
    return `AV-${String(next).padStart(4, "0")}`
}

export function issueCreditNote(ledger: Ledger, invoiceNumber: string, grossCents: number, issuedAt: string): Ledger {
    const invoice = ledger.documents.find((document) => document.number === invoiceNumber)
    const label = `Annulation de la facture ${invoiceNumber}`
    if (invoice === undefined)
        throw new Error(`Invoice ${invoiceNumber} not found`)
    const creditNote: BillingDocument = {
        number: nextCreditNoteNumber(ledger),
        kind: "credit_note",
        issuedAt: issuedAt,
        customerId: invoice.customerId,
        saleId: invoice.saleId,
        lines: [{label, amounts: splitVat(-grossCents) }],
        correctsNumber: invoiceNumber,
    }
    const newLedger = {...ledger, documents: [...ledger.documents, creditNote]}
    return newLedger
    }