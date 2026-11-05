import { NotifyDestroy } from './interface/NotifyDestroy';
import { RadialTileFinder } from '@/game/map/tileFinder/RadialTileFinder';
import { NotifyDamage } from './interface/NotifyDamage';
import { fnv32a } from '@/util/math';
import { BuildingEvacuateEvent } from '@/game/event/BuildingEvacuateEvent';
import { ScatterTask } from '@/game/gameobject/task/ScatterTask';
export class GarrisonTrait {
    private building: Building;
    private evacThreshold: number;
    private maxOccupants: number;
    private units: Unit[] = [];
    constructor(building: Building, evacThreshold: number, maxOccupants: number) {
        this.building = building;
        this.evacThreshold = evacThreshold;
        this.maxOccupants = maxOccupants;
    }
    isOccupied(): boolean {
        return this.units.length > 0;
    }
    canBeOccupied(): boolean {
        return this.building.healthTrait.health > 100 * this.evacThreshold;
    }
    [NotifyDamage.onDamage](building: Building, context: GameContext): void {
        if (building.healthTrait.health <= 100 * this.evacThreshold) {
            this.evacuate(context);
        }
    }
    [NotifyDestroy.onDestroy](building: Building, context: GameContext, reason: any, isImmediate: boolean): void {
        if (isImmediate) {
            for (const unit of this.units) {
                unit.deathType = building.deathType;
                context.destroyObject(unit, reason, true);
            }
            this.units = [];
        }
        else {
            this.evacuate(context);
        }
    }
    getHash(): number {
        return fnv32a(this.units.map(unit => unit.getHash()));
    }
    debugGetState(): {
        units: any[];
    } {
        return { units: this.units.map(unit => unit.debugGetState()) };
    }
    dispose(): void {
        this.building = undefined;
    }
    evacuate(context: GameContext, forceDestroy: boolean = false): void {
        const building = this.building;
        const units = this.units;
        if (units.length) {
            const speedTypeMap = new Map<string, Unit[]>();
            for (const unit of units) {
                speedTypeMap.set(unit.rules.speedType, (speedTypeMap.get(unit.rules.speedType) || []).concat(unit));
            }
            for (const [speedType, typeUnits] of speedTypeMap) {
                const finder = new RadialTileFinder(context.map.tiles, context.map.mapBounds, building.tile, building.art.foundation, 1, 1, (tile) => {
                    return context.map.terrain.getPassableSpeed(tile, speedType, true, false) > 0 &&
                        Math.abs(tile.z - building.tile.z) < 2 &&
                        !context.map.terrain.findObstacles({ tile, onBridge: undefined }, typeUnits[0]).length;
                });
                const exitTile = finder.getNextTile();
                for (const unit of typeUnits) {
                    const unitIndex = units.indexOf(unit);
                    if (exitTile) {
                        units.splice(unitIndex, 1);
                        context.unlimboObject(unit, exitTile);
                        unit.onBridge = context.map.tileOccupation.getBridgeOnTile(exitTile)?.isLowBridge() ?? false;
                        unit.position.tileElevation = 0;
                        unit.unitOrderTrait.addTask(new ScatterTask(context));
                    }
                    else if (!forceDestroy) {
                        context.destroyObject(unit, { player: unit.owner });
                        units.splice(unitIndex, 1);
                    }
                }
            }
            const oldOwner = building.owner;
            if (!units.length && !building.isDestroyed) {
                context.changeObjectOwner(building, context.getCivilianPlayer());
            }
            context.events.dispatch(new BuildingEvacuateEvent(building, oldOwner));
        }
    }
}
