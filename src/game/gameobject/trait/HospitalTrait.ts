import { ObjectType } from '@/engine/type/ObjectType';
import { UnitRepairFinishEvent } from '@/game/event/UnitRepairFinishEvent';
import { GameSpeed } from '@/game/GameSpeed';
import { RadialTileFinder } from '@/game/map/tileFinder/RadialTileFinder';
import { ScatterTask } from '@/game/gameobject/task/ScatterTask';
import { NotifyDestroy } from '@/game/gameobject/trait/interface/NotifyDestroy';
import { NotifyTick } from '@/game/gameobject/trait/interface/NotifyTick';
import { GameObject } from '@/game/gameobject/GameObject';
import { World } from '@/game/World';
export class HospitalTrait {
    private healQueue: GameObject[] = [];
    private unit?: GameObject;
    private healTicks?: number;
    addToHealQueue(unit: GameObject): number {
        this.healQueue.push(unit);
        return this.healQueue.length - 1;
    }
    unitIsFirstInHealQueue(unit: GameObject): boolean {
        return this.healQueue[0] === unit;
    }
    removeFromHealQueue(unit: GameObject): void {
        const index = this.healQueue.indexOf(unit);
        if (index !== -1) {
            this.healQueue.splice(index, 1);
        }
    }
    startHealing(unit: GameObject): void {
        if (this.unit) {
            throw new Error(`Already busy healing unit ${ObjectType[this.unit.type]}#${this.unit.id}`);
        }
        this.unit = unit;
        this.healTicks = 5 * GameSpeed.BASE_TICKS_PER_SECOND;
    }
    [NotifyTick.onTick](hospital: GameObject, world: World): void {
        this.healQueue = this.healQueue.filter((unit) => !unit.isDestroyed && !unit.isCrashing);
        if (this.unit && this.healTicks !== undefined) {
            if (this.healTicks > 0) {
                this.healTicks--;
            }
            if (this.healTicks <= 0) {
                this.healTicks = undefined;
                this.removeFromHealQueue(this.unit);
                this.unit.healthTrait.healToFull(hospital, world);
                if (hospital.ammoTrait) {
                    hospital.ammoTrait.ammo--;
                }
                this.evacuate(this.unit, hospital, world);
                const healedUnit = this.unit;
                this.unit = undefined;
                world.events.dispatch(new UnitRepairFinishEvent(healedUnit, hospital));
            }
        }
    }
    [NotifyDestroy.onDestroy](hospital: GameObject, world: World, source: any): void {
        if (this.unit) {
            this.unit.deathType = hospital.deathType;
            world.destroyObject(this.unit, source, true);
            this.unit = undefined;
        }
    }
    private evacuate(unit: GameObject, hospital: GameObject, world: World): void {
        let targetTile;
        const exitPoint = {
            x: hospital.tile.rx,
            y: hospital.tile.ry + hospital.art.foundation.height
        };
        let tile = world.map.tiles.getByMapCoords(exitPoint.x, exitPoint.y);
        if (tile &&
            world.map.isWithinBounds(tile) &&
            this.canEvacuateTo(tile, unit, hospital, world)) {
            targetTile = tile;
        }
        if (!targetTile) {
            targetTile = new RadialTileFinder(world.map.tiles, world.map.mapBounds, hospital.tile, hospital.art.foundation, 1, 1, (tile) => this.canEvacuateTo(tile, unit, hospital, world)).getNextTile();
        }
        if (targetTile) {
            world.unlimboObject(unit, targetTile);
            unit.unitOrderTrait.addTask(new ScatterTask(world));
        }
        else {
            world.destroyObject(unit, { player: unit.owner });
        }
    }
    private canEvacuateTo(tile: any, unit: GameObject, hospital: GameObject, world: World): boolean {
        return (world.map.terrain.getPassableSpeed(tile, unit.rules.speedType, unit.isInfantry(), false) > 0 &&
            Math.abs(tile.z - hospital.tile.z) < 2 &&
            !world.map.terrain.findObstacles({ tile, onBridge: undefined }, unit).length);
    }
}
