import type { Ledger } from "@/domain/ledger";
import { splitVat } from "@/domain/money";
import type { Sale, BillingDocument } from "@/domain/types";
import { documentTotal } from "@/domain/payments";


export type InvoiceDraft = {
    saleId: string
    customerId: string
    issuedAt: string
    label: string
    grossCents: number
}

export function nextInvoiceNumber(ledger: Ledger): string {
    const invoices = ledger.documents.filter((document) => document.kind === "invoice")
    const next = invoices.length + 1
    return `F-${String(next).padStart(4, "0")}`
}

export function createInvoice(ledger: Ledger, draft: InvoiceDraft): Ledger {
    const invoice: BillingDocument = {
        number: nextInvoiceNumber(ledger),
        kind: "invoice",
        issuedAt: draft.issuedAt,
        customerId: draft.customerId,
        saleId: draft.saleId,
        lines: [{ label: draft.label, amounts: splitVat(draft.grossCents) }],
    }
    const newLedger = {...ledger, documents: [...ledger.documents, invoice]}
    return newLedger
}

export function issueInvoice(ledger: Ledger, sale: Sale, label: string): Ledger {
    return createInvoice(ledger, {
        saleId: sale.id,
        customerId: sale.buyerId,
        issuedAt: sale.soldAt,
        label,
        grossCents: sale.grossCents,
    })
}

export function nextCreditNoteNumber(ledger: Ledger): string {
    const credits = ledger.documents.filter((document) => document.kind === "credit_note")
    const next = credits.length + 1
    return `AV-${String(next).padStart(4, "0")}`
}

export function issueCreditNote(
    ledger: Ledger,
    invoiceNumber: string,
    grossCents: number,
    issuedAt: string,
    label = `Annulation de la facture ${invoiceNumber}`,
): Ledger {
    const invoice = ledger.documents.find((document) => document.number === invoiceNumber)
    if (invoice === undefined) {
        throw new Error(`Invoice ${invoiceNumber} not found`)
    }
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

export function findInvoiceForSale(ledger: Ledger, saleId: string): BillingDocument {
    const invoice = ledger.documents.find(
        (document) => document.saleId === saleId && document.kind === "invoice",
    )
    if (invoice === undefined) {
        throw new Error(`No invoice found for sale ${saleId}`)
    }
    return invoice
}

export function correctInvoice(
    ledger: Ledger,
    invoiceNumber: string,
    correctGrossCents: number,
    correctedAt: string,
    label: string,
): Ledger {
    const invoice = ledger.documents.find((document) => document.number === invoiceNumber)
    if (invoice === undefined) {
        throw new Error(`Invoice ${invoiceNumber} not found`)
    }
    const cancelled = issueCreditNote(ledger, invoiceNumber, documentTotal(invoice), correctedAt)
    return createInvoice(cancelled, {
        saleId: invoice.saleId,
        customerId: invoice.customerId,
        issuedAt: correctedAt,
        label,
        grossCents: correctGrossCents,
    })
}
