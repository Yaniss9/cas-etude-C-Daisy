import type { VatBreakdown } from "@/domain/money";

export type Sale = {
    id: string
    productKind: "single_class" | "class_card" | "subscription" | "gift_voucher" | "workshop"
    buyerId: string
    beneficiaryId: string
    grossCents: number
    soldAt: string
  }

export type Entitlement = {
    id: string
    saleId: string
    unit: "class" | "euro"
    initialQuantity: number
    unitValueCents: number
    expiresAt: string
}

export type DocumentLine = {
    label: string
    amounts: VatBreakdown
}

export type BillingDocument = {
    readonly number: string
    readonly kind: "invoice" | "credit_note"
    readonly issuedAt: string
    readonly customerId: string
    readonly saleId: string
    readonly lines: DocumentLine[]
    readonly correctsNumber?: string
}

export type Payment = {
    id: string
    saleId: string
    kind: "payment" | "refund"
    status: "succeeded" | "failed"
    method: "card" | "sepa" | "gift_voucher" | "cash"
    amountCents: number
    feeCents: number
    paidAt: string
}

export type Consumption = {
    id: string
    entitlementId: string
    kind : "attended" | "late_cancellation" | "expired"
    quantity: number
    occurredAt: string
}
