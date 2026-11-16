import { roundHalfAwayFromZero } from "@/domain/money";

export type PayoutInput = {
    invoicedCents: number
    refundedCents: number
    transactionCount: number
    percentFeeBasisPoints: number
    fixedFeeCents: number
    receivedCents: number
}

export type ReconciliationLine = { label: string; cents: number }

export type Reconciliation = {
    lines: ReconciliationLine[]
    expectedCents: number
    receivedCents: number
    unexplainedCents: number
}

export function explainPayout(input: PayoutInput): Reconciliation {
    const percentFees = roundHalfAwayFromZero(input.invoicedCents * input.percentFeeBasisPoints / 10000)
    const fixedFees = input.transactionCount * input.fixedFeeCents
    const lines: ReconciliationLine[] = [
        { label: "Factures émises sur la période", cents: input.invoicedCents },
        { label: "Remboursements versés", cents: -input.refundedCents },
        { label: "Commissions Stripe (pourcentage)", cents: -percentFees },
        { label: `Frais fixes Stripe (${input.transactionCount} transactions)`, cents: -fixedFees },
    ]
    const expectedCents = lines.reduce((sum, line) => sum + line.cents, 0)
    return {
        lines,
        expectedCents,
        receivedCents: input.receivedCents,
        unexplainedCents: input.receivedCents - expectedCents,
    }
}
