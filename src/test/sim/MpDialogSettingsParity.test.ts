import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("MpDialogSettings", () => {
    test("readIni uses getNumber/getBool directly bool defaults", () => {
        const src = readFileSync(
            join(ROOT, "src/game/rules/MpDialogSettings.ts"),
            "utf8",
        );
        const start = src.indexOf("readIni(");
        const body = src.slice(start);
        expect(body).toContain('section.getNumber("MinMoney")');
        expect(body).toContain('section.getBool("AlliesAllowed", true)');
        expect(body).toContain('section.getBool("AllyChangeAllowed", true)');
        expect(body).toContain('section.getBool("BridgeDestruction", true)');
        expect(body).not.toContain("readOptionalNumber");
        expect(body).not.toContain("readOptionalBool");
        expect(body).not.toContain("section.has(");
    });
});
