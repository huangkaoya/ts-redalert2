import { Coords } from '@/game/Coords';
import { GameSpeed } from '@/game/GameSpeed';
import { RangeHelper } from '@/game/gameobject/unit/RangeHelper';
import { NotifyTick } from './interface/NotifyTick';
import { NotifyWarpChange } from './interface/NotifyWarpChange';
import { GameObject } from '@/game/gameobject/GameObject';
import { World } from '@/game/World';
export class PsychicDetectorTrait {
    private radiusTiles: number;
    private detectionLines: Array<{
        source: GameObject;
        target: any;
    }>;
    private nextScan: number;
    constructor(radiusTiles: number) {
        this.radiusTiles = radiusTiles;
        this.detectionLines = [];
        this.nextScan = GameSpeed.BASE_TICKS_PER_SECOND;
    }
    [NotifyTick.onTick](gameObject: GameObject, world: World): void {
        if (gameObject.owner.powerTrait?.isLowPower()) {
            this.disable();
        }
        else {
            if (this.nextScan > 0) {
                this.nextScan--;
            }
            if (this.nextScan <= 0) {
                this.nextScan = GameSpeed.BASE_TICKS_PER_SECOND;
                this.detectionLines = this.scan(gameObject, world);
            }
        }
    }
    [NotifyWarpChange.onChange](gameObject: GameObject, world: World, isWarping: boolean): void {
        if (isWarping) {
            this.disable();
        }
    }
    disable(): void {
        if (this.detectionLines.length) {
            this.detectionLines = [];
            this.nextScan = 0;
        }
    }
    private scan(gameObject: GameObject, world: World): Array<{
        source: GameObject;
        target: any;
    }> {
        const enemies = world
            .getCombatants()
            .filter(combatant => combatant !== gameObject.owner && !world.alliances.areAllied(combatant, gameObject.owner));
        const detectionLines: Array<{
            source: GameObject;
            target: any;
        }> = [];
        const rangeHelper = new RangeHelper(world.map.tileOccupation);
        // 完善模拟层逻辑：range is measured to the attack/command/path target, not the unit.
        const isInRange = (point: any) =>
            rangeHelper.distance2(point, gameObject) / Coords.LEPTONS_PER_TILE <= this.radiusTiles;
        for (const enemy of enemies) {
            for (const obj of enemy.getOwnedObjects()) {
                if (obj.attackTrait?.currentTarget) {
                    const target = obj.attackTrait.currentTarget;
                    if (isInRange(target.obj ?? target.tile)) {
                        detectionLines.push({ source: obj, target });
                    }
                }
                else if (obj.isUnit() && obj.unitOrderTrait.targetLinesConfig) {
                    const config = obj.unitOrderTrait.targetLinesConfig;
                    if (config.target) {
                        if (isInRange(config.target)) {
                            const target = world.createTarget(config.target, config.target.tile);
                            detectionLines.push({ source: obj, target });
                        }
                    }
                    else {
                        const node = config.pathNodes[0];
                        if (node && isInRange(node.tile)) {
                            const target = world.createTarget(node.onBridge, node.tile);
                            detectionLines.push({ source: obj, target });
                        }
                    }
                }
            }
        }
        return detectionLines;
    }
}
