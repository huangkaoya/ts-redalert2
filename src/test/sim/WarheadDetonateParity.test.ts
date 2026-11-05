import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");
const src = readFileSync(join(ROOT, "src/game/Warhead.ts"), "utf8");

describe("Warhead.detonate", () => {
    test("uses target.getBridge() without optional-call兜底", () => {
        expect(src).toContain("target.obj || target.getBridge()");
        expect(src).not.toContain("target.getBridge?.()");
    });

    test("invulnerable nullify only when computeDamage yields no damage", () => {
        const detonateStart = src.indexOf("detonate(");
        const detonateBody = src.slice(detonateStart, src.indexOf("pickExplodeAnim", detonateStart));
        const zeroDamageGate = detonateBody.indexOf("if (!damage)");
        expect(zeroDamageGate).toBeGreaterThan(-1);
        const afterZero = detonateBody.slice(zeroDamageGate);
        expect(afterZero).toContain("invulnerableTrait.isActive()");
        // Must not re-mark invulnerable after a successful damage path (模拟层 only sets R in the else of `if (i)`)
        const damageLoop = detonateBody.slice(detonateBody.indexOf("for (const distance of objectDistances"));
        const trailingInvuln = damageLoop.match(/invulnerableTrait\.isActive\(\)[\s\S]*hasInvulnerableHit\s*=\s*true/);
        expect(trailingInvuln).toBeNull();
    });
});
