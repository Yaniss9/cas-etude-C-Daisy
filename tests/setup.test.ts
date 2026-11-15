import { describe, expect, it } from "vitest";

// Test de fumée : vérifie que Vitest tourne et que l'alias "@/" pointe bien vers src/.
// À supprimer quand les vrais tests des cas (tests/cases/) existeront.
describe("installation", () => {
  it("résout le module du domaine via l'alias @/", async () => {
    const domain = await import("@/domain");
    expect(domain).toBeDefined();
  });
});
