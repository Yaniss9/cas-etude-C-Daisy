import { explainPayout } from "@/domain/reconciliation";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function formatCents(cents: number): string {
  return euros.format(cents / 100);
}

function formatSigned(cents: number): string {
  if (cents === 0) return formatCents(0);
  return `${cents > 0 ? "+" : "−"} ${formatCents(Math.abs(cents))}`;
}

const march = explainPayout({
  invoicedCents: 432000,
  refundedCents: 7500,
  transactionCount: 87,
  percentFeeBasisPoints: 140,
  fixedFeeCents: 25,
  receivedCents: 418745,
});

const runningTotals = march.lines.reduce<number[]>(
  (totals, line) => [...totals, (totals.at(-1) ?? 0) + line.cents],
  [],
);

function SummaryCard({ label, cents, tone }: { label: string; cents: number; tone?: "warning" }) {
  const toneClasses =
    tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <p className="text-sm opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {tone === "warning" ? formatSigned(cents) : formatCents(cents)}
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-zinc-500">Atelier Terre &amp; Feu · cas C12</p>
        <h1 className="text-3xl font-semibold">Rapprochement bancaire — mars</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Pourquoi le virement Stripe ne correspond pas aux factures du mois, ligne par ligne.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Facturé sur le mois" cents={march.lines[0]?.cents ?? 0} />
        <SummaryCard label="Reçu de Stripe" cents={march.receivedCents} />
        <SummaryCard label="Écart non expliqué" cents={march.unexplainedCents} tone="warning" />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Du facturé au virement</th>
              <th className="px-4 py-3 text-right font-medium">Montant</th>
              <th className="px-4 py-3 text-right font-medium">Cumul</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {march.lines.map((line, index) => (
              <tr key={line.label}>
                <td className="px-4 py-3">{line.label}</td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${line.cents < 0 ? "text-red-600 dark:text-red-400" : ""}`}
                >
                  {index === 0 ? formatCents(line.cents) : formatSigned(line.cents)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                  {formatCents(runningTotals[index] ?? 0)}
                </td>
              </tr>
            ))}
            <tr className="bg-zinc-50 font-medium dark:bg-zinc-900">
              <td className="px-4 py-3">Attendu sur le compte</td>
              <td className="px-4 py-3 text-right tabular-nums" colSpan={2}>
                {formatCents(march.expectedCents)}
              </td>
            </tr>
            <tr className="font-medium">
              <td className="px-4 py-3">Reçu (relevé Stripe)</td>
              <td className="px-4 py-3 text-right tabular-nums" colSpan={2}>
                {formatCents(march.receivedCents)}
              </td>
            </tr>
            <tr className="bg-amber-50 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <td className="px-4 py-3">Écart non expliqué</td>
              <td className="px-4 py-3 text-right tabular-nums" colSpan={2}>
                {formatSigned(march.unexplainedCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          <strong className="text-zinc-900 dark:text-zinc-100">Pourquoi afficher l&apos;écart plutôt que le masquer ?</strong>{" "}
          Les chiffres fournis ne suffisent pas à l&apos;expliquer au centime. Tout ce qui est facturé dans le mois
          n&apos;est pas forcément encaissé par Stripe dans le mois (impayés, bons cadeaux, paiements de factures
          d&apos;autres mois), et les commissions réelles sont arrondies transaction par transaction.
        </p>
        <p>
          Hypothèse : la commission de 1,4 % est calculée ici sur le total facturé, faute du détail des 87
          transactions. Avec ce détail, on la calculerait paiement par paiement.
        </p>
      </section>
    </main>
  );
}
