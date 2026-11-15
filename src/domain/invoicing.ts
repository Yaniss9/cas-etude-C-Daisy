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