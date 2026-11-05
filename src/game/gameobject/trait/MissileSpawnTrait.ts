import { CollisionType } from '@/game/gameobject/unit/CollisionType';
import { NotifyDestroy } from './interface/NotifyDestroy';
import { GameObject } from '@/game/gameobject/GameObject';
import { World } from '@/game/World';
import { SpecialWarheadType } from '@/game/SpecialWarheadType';
export class MissileSpawnTrait {
    private warhead?: any;
    private damage?: number;
    private launcher?: GameObject;
    setWarhead(warhead: any): this {
        this.warhead = warhead;
        return this;
    }
    setDamage(damage: number): this {
        this.damage = damage;
        return this;
    }
    setLauncher(launcher: GameObject): this {
        this.launcher = launcher;
        return this;
    }
    [NotifyDestroy.onDestroy](gameObject: GameObject, world: World): void {
        if (this.warhead && this.damage && this.launcher) {
            this.warhead.detonate(world, this.damage, gameObject.tile, gameObject.tileElevation, gameObject.position.worldPosition, gameObject.zone, CollisionType.None, world.createTarget(undefined, gameObject.tile), { player: gameObject.owner, obj: this.launcher, weapon: undefined } as any, SpecialWarheadType.None);
        }
    }
    dispose(): void {
        this.launcher = undefined;
    }
}
