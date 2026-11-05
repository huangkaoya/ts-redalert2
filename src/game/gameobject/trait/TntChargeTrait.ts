import { Coords } from '@/game/Coords';
import { Warhead } from '@/game/Warhead';
import { DeathType } from '@/game/gameobject/common/DeathType';
import { CollisionType } from '@/game/gameobject/unit/CollisionType';
import { Timer } from '@/game/gameobject/unit/Timer';
import { NotifyDestroy } from './interface/NotifyDestroy';
import { NotifyTick } from './interface/NotifyTick';
import { GameObject } from '@/game/gameobject/GameObject';
import { World } from '@/game/World';
import { SpecialWarheadType } from '@/game/SpecialWarheadType';
export class TntChargeTrait {
    private timer: Timer;
    private attackerInfo?: any;
    constructor() {
        this.timer = new Timer();
    }
    hasCharge(): boolean {
        return this.timer.isActive();
    }
    setCharge(ticks: number, currentTick: number, attackerInfo: any): void {
        if (!this.hasCharge()) {
            this.timer.setActiveFor(ticks, currentTick);
            this.attackerInfo = attackerInfo;
        }
    }
    getChargeOwner(): any {
        return this.attackerInfo?.player;
    }
    removeCharge(): void {
        this.timer.reset();
    }
    getTicksLeft(): number {
        return this.timer.getTicksLeft();
    }
    getInitialTicks(): number {
        return this.timer.getInitialTicks();
    }
    [NotifyTick.onTick](gameObject: GameObject, world: World): void {
        if (this.timer.isActive() && this.timer.tick(world.currentTick) === true) {
            if (gameObject.isBuilding() && gameObject.cabHutTrait) {
                gameObject.cabHutTrait.demolishBridge(world, this.attackerInfo);
            }
            this.detonateIvanWarhead(world, gameObject);
        }
    }
    [NotifyDestroy.onDestroy](gameObject: GameObject, world: World, context?: any): void {
        if (this.timer.isActive() &&
            !context?.weapon?.warhead.rules.ivanBomb &&
            ![DeathType.None, DeathType.Temporal, DeathType.Sink].includes(gameObject.deathType)) {
            this.timer.reset();
            this.detonateIvanWarhead(world, gameObject);
        }
    }
    private detonateIvanWarhead(world: World, target: GameObject): void {
        const damage = world.rules.combatDamage.ivanDamage;
        const warhead = new Warhead(world.rules.getWarhead(world.rules.combatDamage.ivanWarhead));
        const tile = target.tile;
        const elevation = target.tileElevation;
        const zone = target.isUnit() ? target.zone : world.map.getTileZone(tile);
        const onBridge = !!target.isUnit() && target.onBridge;
        warhead.detonate(world as any, damage, tile, elevation, target.isBuilding()
            ? Coords.tile3dToWorld(tile.rx + 0.5, tile.ry + 0.5, tile.z + elevation)
            : target.position.worldPosition, zone, onBridge ? CollisionType.OnBridge : CollisionType.None, world.createTarget(target, tile), { ...this.attackerInfo, weapon: undefined }, SpecialWarheadType.TntCharge);
    }
}
