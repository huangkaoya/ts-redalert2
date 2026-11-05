import { LandType } from '@/game/type/LandType';
import { GameObject } from '@/game/gameobject/GameObject';
import { World } from '@/game/World';
import { TiberiumRules } from '@/game/rules/TiberiumRules';
export class TiberiumTrait {
    static maxBails: number = 11;
    private gameObject: GameObject;
    private rules: TiberiumRules;
    constructor(gameObject: GameObject, rules: TiberiumRules) {
        this.gameObject = gameObject;
        this.rules = rules;
    }
    static canBePlacedOn(tile: any, world: World): boolean {
        return ([LandType.Clear, LandType.Road, LandType.Rough].includes(tile.landType) &&
            !world
                .getGroundObjectsOnTile(tile)
                .find((obj) => !obj.isSmudge() && !obj.isUnit()));
    }
    getTiberiumType() {
        return this.rules.type;
    }
    collectBail() {
        const bailCount = this.getBailCount();
        if (bailCount <= 0) {
            throw new Error('Attempted to collect an ore bail, but there are none left');
        }
        this.gameObject.value--;
        return bailCount > 1 ? this.getTiberiumType() : undefined;
    }
    spawnBails(count: number): void {
        this.gameObject.value = Math.min(TiberiumTrait.maxBails, this.gameObject.value + count);
    }
    removeBails(count: number): void {
        this.gameObject.value = Math.max(-1, this.gameObject.value - count);
    }
    getBailCount(): number {
        return this.gameObject.value + 1;
    }
    dispose(): void {
        this.gameObject = undefined as any;
    }
}
