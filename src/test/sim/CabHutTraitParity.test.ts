import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("CabHutTrait", () => {
    test("demolishBridge skips low non-water bridges and destroyed pieces before demolish", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/CabHutTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("demolishBridge(");
        const end = src.indexOf("\n    getBridgePieces(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("piece.obj.isLowBridge()");
        expect(body).toContain("ZoneType.Water");
        expect(body).toContain("piece.obj.isDestroyed");
        expect(body).toContain("DeathType.Demolish");
        expect(body).toContain("destroyObject(piece.obj, attacker, true)");
        // Must skip (continue) when A || isDestroyed — not demolish on A || !isDestroyed
        expect(body).toContain("piece.obj.isDestroyed) {\n                    continue;");
        expect(body).not.toContain("!piece.obj.isDestroyed");
    });
});
