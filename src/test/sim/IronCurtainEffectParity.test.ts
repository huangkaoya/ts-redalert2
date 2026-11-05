import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("IronCurtainEffect", () => {
    test("onStart skips destroyed technos before organic/invulnerable branch", () => {
        const src = readFileSync(
            join(ROOT, "src/game/superweapon/IronCurtainEffect.ts"),
            "utf8",
        );
        const start = src.indexOf("onStart(");
        const body = src.slice(start, src.indexOf("onTick("));
        expect(body).toContain("object.isDestroyed");
        expect(body).toContain("object.rules.organic");
        expect(body).toContain("invulnerableTrait.setActiveFor");
        // Destroyed gate must be in the continue condition, not only organic branch.
        const continueBlock = body.slice(
            body.indexOf("if (!object.isTechno()"),
            body.indexOf("if (object.rules.organic)"),
        );
        expect(continueBlock).toContain("object.isDestroyed");
        expect(body).not.toContain("if (!object.isDestroyed) {\n                        game.destroyObject");
    });
});
