import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("ObjectArt.init", () => {
    test("Image has no || \"\" fallback; Report/StartSound coerce falsy to undefined", () => {
        const src = readFileSync(join(ROOT, "src/game/art/ObjectArt.ts"), "utf8");
        const start = src.indexOf("private init()");
        const end = src.indexOf("get imageName()", start);
        const body = src.slice(start, end);
        expect(body).toContain('this.art.getString("Image")');
        expect(body).not.toContain('getString("Image") || ""');
        expect(body).toContain('this.art.getString("Report") || undefined');
        expect(body).toContain('this.art.getString("StartSound") || undefined');
        expect(body).toContain('this.toOverlay = this.art.getString("ToOverlay") || undefined');
    });

    test("ObjectFactory skips TntChargeTrait when art.toOverlay is set", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/ObjectFactory.ts"), "utf8");
        expect(src).toContain("gameObject.rules.bombable && !gameObject.art.toOverlay");
    });

    test("readFlatness forces flat for non-wall/crate/rock overlays", () => {
        const src = readFileSync(join(ROOT, "src/game/art/ObjectArt.ts"), "utf8");
        const start = src.indexOf("private readFlatness()");
        const end = src.indexOf("\n    private readRotors", start);
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain('this.art.getBool("Flat")');
        expect(body).not.toContain('getBool("Flat", false)');
        expect(body).toContain(
            "!(overlayRules.wall || overlayRules.crate || overlayRules.isARock)",
        );
        expect(body).not.toMatch(
            /if \(overlayRules\.wall \|\| overlayRules\.crate \|\| overlayRules\.isARock\) \{\s*flat = true;/,
        );
    });
});
