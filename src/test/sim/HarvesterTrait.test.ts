import { describe, expect, test } from 'bun:test';
import { HarvesterTrait } from '@/game/gameobject/trait/HarvesterTrait';
import { TiberiumType } from '@/engine/type/TiberiumType';

describe('HarvesterTrait (模拟层 parity)', () => {
    test('addBails / getBails / empty match 模拟层 storage semantics', () => {
        const trait = new HarvesterTrait(10);
        expect(trait.isEmpty()).toBe(true);
        trait.addBails(TiberiumType.Ore, 3);
        trait.addBails(TiberiumType.Gems, 2);
        expect(trait.ore).toBe(3);
        expect(trait.gems).toBe(2);
        expect(trait.getBails()).toEqual([
            [TiberiumType.Ore, 3],
            [TiberiumType.Gems, 2],
        ]);
        expect(trait.isFull()).toBe(false);
        trait.addBails(TiberiumType.Ore, 5);
        expect(trait.isFull()).toBe(true);
        trait.empty();
        expect(trait.isEmpty()).toBe(true);
        expect(trait.getBails()).toEqual([]);
        expect(trait.getHash()).toBe(0);
    });
});
