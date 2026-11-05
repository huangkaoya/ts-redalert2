import { describe, expect, test } from 'bun:test';
import { SpecialWarheadType } from '@/game/SpecialWarheadType';
import { Warhead } from '@/game/Warhead';

describe('Warhead SpecialWarheadType (模拟层 parity)', () => {
    test('detonate signature accepts SpecialWarheadType without inventing fallback types', () => {
        const warhead = Object.create(Warhead.prototype) as Warhead;
        expect(typeof warhead.detonate).toBe('function');
        expect(SpecialWarheadType.None).toBe(0);
        expect(SpecialWarheadType.Shrapnel).toBe(1);
        expect(SpecialWarheadType.LightningStrike).toBe(2);
        expect(SpecialWarheadType.TntCharge).toBe(3);
        expect(warhead.detonate.length).toBeGreaterThanOrEqual(9);
    });
});
