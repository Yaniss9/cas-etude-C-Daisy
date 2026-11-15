// Page provisoire. L'interface du rapprochement bancaire (cas C12) viendra en dernière étape,
// une fois le moteur de facturation et ses tests terminés.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Daisy — Facturation</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Le moteur de facturation vit dans <code>src/domain</code> et se vérifie avec{" "}
        <code>npm test</code>. Cette interface accueillera le rapprochement bancaire (C12).
      </p>
    </main>
  );
}
