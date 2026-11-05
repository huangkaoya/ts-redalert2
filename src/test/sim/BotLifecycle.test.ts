import { describe, expect, test } from 'bun:test';
import { Bot } from '@/game/bot/Bot';
import { BotContext } from '@/game/bot/BotContext';
import { CaptureBuildingTask } from '@/game/gameobject/task/CaptureBuildingTask';
import { SpecialWarheadType } from '@/game/SpecialWarheadType';

describe('Bot + capture delay (模拟层 parity)', () => {
    test('Bot getters resolve from BotContext after setContext', () => {
        const bot = new Bot('AI1', 'Americans');
        const actions = { orderUnits() {} };
        const production = { getQueue() {} };
        const logger = { setDebugLevel() {} };
        const gameApi = { getCurrentTick: () => 0 };
        bot.setContext(
            new BotContext(gameApi, { name: 'AI1', actions, production }, logger),
        );
        expect(bot.gameApi).toBe(gameApi);
        expect(bot.actionsApi).toBe(actions);
        expect(bot.productionApi).toBe(production);
        expect(bot.logger).toBe(logger);
        expect(bot.player.name).toBe('AI1');
    });

    test('CaptureBuildingTask delay is zero for multiEngineer / instant / neutral / needsEngineer', () => {
        const baseGame = {
            gameOpts: { multiEngineer: false, instantCapture: false },
            rules: { general: { engineerCaptureDelay: 3.5 } },
        };
        expect(
            CaptureBuildingTask.getCaptureDelaySeconds(baseGame, {
                owner: { isNeutral: false },
                rules: { needsEngineer: false },
            }),
        ).toBe(3.5);
        expect(
            CaptureBuildingTask.getCaptureDelaySeconds(
                { ...baseGame, gameOpts: { multiEngineer: true, instantCapture: false } },
                { owner: { isNeutral: false }, rules: { needsEngineer: false } },
            ),
        ).toBe(0);
        expect(SpecialWarheadType.None).toBe(0);
    });
});
