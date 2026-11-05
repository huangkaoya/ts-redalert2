import { describe, expect, test } from 'bun:test';
import { CastProgressTrait } from '@/game/gameobject/trait/CastProgressTrait';
import { SecureProgressTrait } from '@/game/gameobject/trait/SecureProgressTrait';
import { NotifyTick } from '@/game/gameobject/trait/interface/NotifyTick';
import { GameSpeed } from '@/game/GameSpeed';
import { SpecialWarheadType } from '@/game/SpecialWarheadType';
import { MoveNextToTask } from '@/game/gameobject/task/move/MoveNextToTask';
import { BotContext } from '@/game/bot/BotContext';

describe('模拟层 sim-layer missing modules', () => {
    test('SpecialWarheadType matches 模拟层 enum values', () => {
        expect(SpecialWarheadType.None).toBe(0);
        expect(SpecialWarheadType.Shrapnel).toBe(1);
        expect(SpecialWarheadType.LightningStrike).toBe(2);
        expect(SpecialWarheadType.TntCharge).toBe(3);
    });

    test('BotContext stores constructor args', () => {
        const ctx = new BotContext('game', 'player', 'logger');
        expect(ctx.game).toBe('game');
        expect(ctx.player).toBe('player');
        expect(ctx.logger).toBe('logger');
    });

    test('CastProgressTrait follows 模拟层 start/tick/complete semantics without fallbacks', () => {
        const trait = new CastProgressTrait();
        expect(trait.getProgress()).toBe(0);
        trait.start(0);
        expect(trait.isCasting()).toBe(false);
        trait.start(1);
        expect(trait.isCasting()).toBe(true);
        const ticks = Math.round(1 * GameSpeed.BASE_TICKS_PER_SECOND);
        for (let i = 0; i < ticks - 1; i++) {
            trait[NotifyTick.onTick]({}, { currentTick: i });
            expect(trait.isCompleted()).toBe(false);
        }
        trait[NotifyTick.onTick]({}, { currentTick: ticks });
        expect(trait.isCompleted()).toBe(true);
        expect(trait.getProgress()).toBe(1);
    });

    test('SecureProgressTrait rejects non-neutral / destroyed / zero-duration without inventing success', () => {
        const trait = new SecureProgressTrait(0);
        expect(
            trait.start(
                { owner: { isNeutral: true }, isDestroyed: false },
                { name: 'p1' },
            ),
        ).toBe(false);

        const active = new SecureProgressTrait(1 / 60);
        const player = { name: 'p1', defeated: false, buildingsCaptured: 0, color: { asHex: () => 1 } };
        expect(
            active.start(
                { owner: { isNeutral: false }, isDestroyed: false },
                player,
            ),
        ).toBe(false);
        expect(
            active.start(
                { owner: { isNeutral: true }, isDestroyed: true },
                player,
            ),
        ).toBe(false);
        expect(
            active.start(
                { owner: { isNeutral: true }, isDestroyed: false },
                player,
            ),
        ).toBe(true);
        expect(active.isActiveFrom(player)).toBe(true);
    });

    test('MoveNextToTask uses 模拟层 closeEnoughTiles / strictCloseEnough options', () => {
        const target = {
            isBuilding: () => false,
            tile: { rx: 1, ry: 2 },
        };
        const game = {
            map: {
                mapBounds: { isWithinBounds: () => true },
                tileOccupation: {
                    calculateTilesForGameObject: () => [],
                    isTileOccupiedBy: () => false,
                },
            },
        };
        const task = new MoveNextToTask(game, target);
        expect((task as any).options.closeEnoughTiles).toBe(Math.SQRT2);
        expect((task as any).options.strictCloseEnough).toBe(true);
        expect(task.target).toBe(target);
    });
});
