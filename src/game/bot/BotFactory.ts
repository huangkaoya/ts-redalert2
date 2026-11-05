import { AiDifficulty } from '../gameopts/GameOpts';
import { Bot } from './Bot';
import { DummyBot } from './DummyBot';
import { BuiltInBotAdapter } from '../ai/thirdpartbot/builtIn/BuiltInBotAdapter';
import { BotRegistry } from '../ai/thirdpartbot/BotRegistry';
import { ThirdPartyBotAdapter } from '../ai/thirdpartbot/ThirdPartyBotAdapter';
export class BotFactory {
    private botsLib: any;
    constructor(botsLib: any) {
        this.botsLib = botsLib;
    }
    create(player: {
        isAi: boolean;
        name: string;
        aiDifficulty: AiDifficulty;
        country: {
            name: string;
        };
        customBotId?: string;
    }): Bot {
        if (!player.isAi) {
            throw new Error(`Player "${player.name}" is not an AI`);
        }

        // Local-only difficulties (not present in 模拟层 AiDifficulty): keep third-party /
        // built-in adapters for lobby Custom/Normal/MediumSea without altering 模拟层's
        // Easy/Medium/Brutal mapping.
        if (player.aiDifficulty === AiDifficulty.Custom) {
            const registry = BotRegistry.getInstance();
            if (player.customBotId) {
                const meta = registry.get(player.customBotId);
                if (meta) {
                    console.info(`[BotFactory] Using bot "${meta.displayName}" for "${player.name}"`);
                    return new ThirdPartyBotAdapter(player.name, player.country.name, meta);
                }
                throw new Error(`Custom bot "${player.customBotId}" not found`);
            }
            const uploadedBots = registry.getUploadedBots();
            if (uploadedBots.length > 0) {
                const meta = uploadedBots[0];
                console.info(`[BotFactory] Using uploaded bot "${meta.displayName}" for "${player.name}"`);
                return new ThirdPartyBotAdapter(player.name, player.country.name, meta);
            }
            throw new Error(`Custom AI selected but no uploaded bot found for player "${player.name}"`);
        }
        if (player.aiDifficulty === AiDifficulty.Normal ||
            player.aiDifficulty === AiDifficulty.MediumSea) {
            return new BuiltInBotAdapter(player.name, player.country.name);
        }
        // 完善模拟层逻辑：BotFactory for shared difficulty values.
        switch (player.aiDifficulty) {
            case AiDifficulty.Easy:
                return new DummyBot(player.name, player.country.name);
            case AiDifficulty.Medium:
                if (this.botsLib.SupalosaBot) {
                    return new this.botsLib.SupalosaBot(player.name, player.country.name);
                }
            // fallthrough
            default:
                throw new Error(`Unsupported AI difficulty "${player.aiDifficulty}"`);
        }
    }
}
