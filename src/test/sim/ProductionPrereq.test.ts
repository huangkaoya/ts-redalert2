import { describe, expect, test } from 'bun:test';
import { SideType } from '@/game/SideType';

describe('Production stolen tech / SideType (模拟层 parity)', () => {
    test('ThirdSide sits between Nod and Civilian in SideType', () => {
        expect(SideType.Nod).toBe(1);
        expect(SideType.ThirdSide).toBe(2);
        expect(SideType.Civilian).toBe(3);
    });
});
