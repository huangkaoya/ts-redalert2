import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");
const src = readFileSync(join(ROOT, "src/game/map/Bridges.ts"), "utf8");

describe("Bridges.findClosestBridgeSpec", () => {
    test("BridgeSpec includes isXBridge return shape", () => {
        expect(src).toMatch(/interface BridgeSpec\s*\{[\s\S]*isXBridge:\s*boolean/);
        const method = src.slice(src.indexOf("findClosestBridgeSpec("));
        const ret = method.slice(method.indexOf("return {"), method.indexOf("};", method.indexOf("return {")) + 2);
        expect(ret).toContain("isXBridge");
        expect(ret).toContain("isHigh: isHighBridge");
    });
});
