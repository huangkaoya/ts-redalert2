import { describe, expect, test } from 'bun:test';
import { ArmorType } from '@/game/type/ArmorType';

/**
 * 完善模拟层逻辑：AttackOrder.isValid non-force overlay terminal condition:
 * (overlay && (wall || (wood && armor===Wood))) || isTechno
 */
function wanOverlayAttackAllowed(target: {
    isOverlay(): boolean;
    isTechno(): boolean;
    rules: { armor: ArmorType };
}, weapon: { warhead: { rules: { wall: boolean; wood: boolean } } }): boolean {
    return (
        (target.isOverlay() &&
            (weapon.warhead.rules.wall ||
                (weapon.warhead.rules.wood && target.rules.armor === ArmorType.Wood))) ||
        target.isTechno()
    );
}

describe('AttackOrder overlay validity (模拟层 parity)', () => {
    test('wall overlay with wall warhead is attackable', () => {
        expect(
            wanOverlayAttackAllowed(
                {
                    isOverlay: () => true,
                    isTechno: () => false,
                    rules: { armor: ArmorType.Steel },
                },
                { warhead: { rules: { wall: true, wood: false } } },
            ),
        ).toBe(true);
    });

    test('plain techno target remains attackable without wall warhead', () => {
        expect(
            wanOverlayAttackAllowed(
                {
                    isOverlay: () => false,
                    isTechno: () => true,
                    rules: { armor: ArmorType.Steel },
                },
                { warhead: { rules: { wall: false, wood: false } } },
            ),
        ).toBe(true);
    });

    test('non-wall overlay without matching warhead is not attackable', () => {
        expect(
            wanOverlayAttackAllowed(
                {
                    isOverlay: () => true,
                    isTechno: () => false,
                    rules: { armor: ArmorType.Steel },
                },
                { warhead: { rules: { wall: false, wood: false } } },
            ),
        ).toBe(false);
    });
});
