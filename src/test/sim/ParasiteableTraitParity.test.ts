import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("ParasiteableTrait", () => {
    test("shouldSupressParasite uses base damage minus threshold window", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/ParasiteableTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("private shouldSupressParasite(");
        const end = src.indexOf("\n    [NotifyTeleport.onBeforeTeleport]");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("!parasite.invulnerableTrait.isActive()");
        expect(body).toContain("lastExternalBaseDamage");
        expect(body).toContain("suppressionThreshold");
        expect(body).toContain(
            "2 * (this.lastExternalBaseDamage - parasite.rules.suppressionThreshold)",
        );
        expect(body).not.toContain("destroyer");
        expect(body).not.toContain("lastExternalDamageInflicted");
    });

    test("onDamage stores weapon rules.damage as base damage", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/ParasiteableTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("[NotifyDamage.onDamage]");
        const end = src.indexOf("\n    [NotifyAttack.onAttack]");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("this.lastAttacker = attacker");
        expect(body).toContain("attacker?.weapon?.rules.damage ?? damage");
        expect(body).toContain("lastExternalBaseDamage");
    });

    test("onHeal destroys organic parasites when healer has unitRepair", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/ParasiteableTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("[NotifyHeal.onHeal]");
        const end = src.indexOf("\n    [NotifyDamage.onDamage]");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("!this.parasite.rules.organic || healer?.rules.unitRepair");
        expect(body).toContain("DeathType.None");
        expect(body).toContain("stunParasite");
    });

    test("onBeforeTeleport can suppress-destroy via lastAttacker", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/ParasiteableTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("[NotifyTeleport.onBeforeTeleport]");
        const end = src.indexOf("\n    private stunParasite(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("shouldSupressParasite(gameState, this.parasite)");
        expect(body).toContain("destroyObject(this.parasite, this.lastAttacker)");
        expect(body).toContain("evictOrDestroyParasite(target, gameState, true)");
    });
});
