import { describe, expect, test } from 'bun:test';
import { SideType } from '@/game/SideType';
import { RangeHelper } from '@/game/gameobject/unit/RangeHelper';
import { Vector2 } from '@/game/math/Vector2';
import { Coords } from '@/game/Coords';

describe('SideType + RangeHelper (模拟层 parity)', () => {
    test('SideType numeric values match 模拟层', () => {
        expect(SideType.GDI).toBe(0);
        expect(SideType.Nod).toBe(1);
        expect(SideType.ThirdSide).toBe(2);
        expect(SideType.Civilian).toBe(3);
        expect(SideType.Mutant).toBe(4);
    });

    test('isInTileRange uses unit map position when target is a unit', () => {
        const helper = new RangeHelper({
            calculateTilesForGameObject: () => [],
        } as any);
        const sourceTile = { rx: 10, ry: 10, z: 0 };
        const targetUnit = {
            isUnit: () => true,
            position: {
                getMapPosition: () =>
                    new Vector2(10.5, 12.5).multiplyScalar(Coords.LEPTONS_PER_TILE),
                worldPosition: { x: 0, y: 0, z: 0 },
            },
            tile: { rx: 10, ry: 12, z: 0 },
        };
        expect(helper.isInTileRange(sourceTile as any, targetUnit as any, 0, 3)).toBe(true);
        expect(helper.isInTileRange(sourceTile as any, targetUnit as any, 0, 1)).toBe(false);
    });

    test('computeWeaponRangeVsTarget building bonus matches 模拟层 (w+h)/4', () => {
        const helper = new RangeHelper({ calculateTilesForGameObject: () => [] } as any);
        const shooter = {
            position: { tileElevation: 0, worldPosition: { x: 0, y: 0, z: 0 } },
            tile: { rx: 0, ry: 0, z: 0 },
            tileElevation: 0,
            isUnit: () => true,
            isBuilding: () => false,
            isTechno: () => true,
            rules: { airRangeBonus: 0 },
        };
        const building = {
            position: { tileElevation: 0, worldPosition: { x: 0, y: 0, z: 0 } },
            tile: { rx: 5, ry: 5, z: 0 },
            tileElevation: 0,
            isUnit: () => false,
            isBuilding: () => true,
            isTechno: () => true,
            getFoundation: () => ({ width: 4, height: 3 }),
            rules: { airRangeBonus: 0 },
        };
        const baseWeapon = {
            minRange: 0,
            range: 5,
            rules: {},
            projectileRules: { arcing: false, vertical: false, subjectToElevation: false, isAntiAir: false },
            warhead: { rules: { ivanBomb: false } },
        };
        expect(helper.computeWeaponRangeVsTarget(shooter as any, building as any, baseWeapon as any, {} as any))
            .toEqual({ minRange: 0, range: 5 + (4 + 3) / 4 });

        const ivanWeapon = {
            ...baseWeapon,
            warhead: { rules: { ivanBomb: true } },
        };
        expect(helper.computeWeaponRangeVsTarget(shooter as any, building as any, ivanWeapon as any, {} as any))
            .toEqual({ minRange: 0, range: 5 });
    });
});
