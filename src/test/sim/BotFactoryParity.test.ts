import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("BotFactory", () => {
    test("Easy uses DummyBot; Medium uses botsLib.SupalosaBot; Brutal unsupported", () => {
        const src = readFileSync(join(ROOT, "src/game/bot/BotFactory.ts"), "utf8");
        expect(src).toContain("case AiDifficulty.Easy:");
        expect(src).toContain("return new DummyBot(player.name, player.country.name)");
        expect(src).toContain("case AiDifficulty.Medium:");
        expect(src).toContain("this.botsLib.SupalosaBot");
        expect(src).toContain('Unsupported AI difficulty "${player.aiDifficulty}"');
        // No silent DummyBot/BuiltIn fallback for 模拟层 Medium/Brutal paths.
        expect(src).not.toMatch(/AiDifficulty\.Brutal[\s\S]{0,80}DummyBot/);
        expect(src).not.toMatch(/AiDifficulty\.Medium[\s\S]{0,120}DummyBot/);
    });

    test("Custom difficulty does not silently fall back to BuiltInBotAdapter", () => {
        const src = readFileSync(join(ROOT, "src/game/bot/BotFactory.ts"), "utf8");
        expect(src).not.toContain("falling back to BuiltInBotAdapter");
        expect(src).toContain('Custom AI selected but no uploaded bot found');
    });
});
