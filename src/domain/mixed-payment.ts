import { findEntitlement, redeemVoucher } from "@/domain/entitlements";
import { findInvoiceForSale, nextInvoiceNumber } from "@/domain/invoicing";
import { addSale } from "@/domain/ledger";
import type { Ledger } from "@/domain/ledger";
import { splitVat } from "@/domain/money";
import type { BillingDocument, Sale } from "@/domain/types";

export function sellWithVoucher(
    ledger: Ledger,
    sale: Sale,
    voucherEntitlementId: string,
    voucherCents: number,
    label: string,
): Ledger {
    if (voucherCents > sale.grossCents) {
        throw new Error(`Voucher amount exceeds the price of sale ${sale.id}`)
    }
    const voucher = findEntitlement(ledger, voucherEntitlementId)
    const voucherInvoice = findInvoiceForSale(ledger, voucher.saleId)
    const withSale = addSale(ledger, sale)
    const redeemed = redeemVoucher(withSale, voucherEntitlementId, voucherCents, sale.soldAt)
    if (voucherCents === sale.grossCents) {
        return redeemed
    }
    const invoice: BillingDocument = {
        number: nextInvoiceNumber(redeemed),
        kind: "invoice",
        issuedAt: sale.soldAt,
        customerId: sale.buyerId,
        saleId: sale.id,
        lines: [
            { label, amounts: splitVat(sale.grossCents) },
            { label: `Bon cadeau ${voucherInvoice.number} (déjà facturé)`, amounts: splitVat(-voucherCents) },
        ],
    }
    return { ...redeemed, documents: [...redeemed.documents, invoice] }
}
