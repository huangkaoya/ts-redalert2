import { UnitRepairFinishEvent } from '@/game/event/UnitRepairFinishEvent';
import { UnitRepairStartEvent } from '@/game/event/UnitRepairStartEvent';
import { GameSpeed } from '@/game/GameSpeed';
import { Vector2 } from '@/game/math/Vector2';
import { MoveTask } from '@/game/gameobject/task/move/MoveTask';
import { ZoneType } from '@/game/gameobject/unit/ZoneType';
import { NotifySpawn } from './interface/NotifySpawn';
import { NotifyTick } from './interface/NotifyTick';
import { GameObject } from '@/game/gameobject/GameObject';
import { World } from '@/game/World';
export enum RepairStatus {
    Idle = 0,
    Repairing = 1
}
export class UnitRepairTrait {
    private status: RepairStatus = RepairStatus.Idle;
    private cooldownTicks: number = 0;
    private lastRepairTickSuccessful: boolean = false;
    [NotifySpawn.onSpawn](gameObject: GameObject, world: World): void {
        this.resetRallyPoint(gameObject, world);
    }
    private resetRallyPoint(gameObject: GameObject, world: World): void {
        if (!gameObject.factoryTrait) {
            const rallyPoint = this.computeDefaultRallyPoint(gameObject, world.map);
            gameObject.rallyTrait.changeRallyPoint(rallyPoint, gameObject, world);
        }
    }
    [NotifyTick.onTick](gameObject: GameObject, world: World): void {
        if (!gameObject.dockTrait || (gameObject.rules.needsEngineer && gameObject.owner.isNeutral)) {
            return;
        }
        if (!gameObject.dockTrait.hasDockedUnits() ||
            gameObject.dockTrait.getDockedUnits().some(unit => unit.zone === ZoneType.Air) ||
            (gameObject.poweredTrait && !gameObject.poweredTrait.isPoweredOn())) {
            this.status = RepairStatus.Idle;
            return;
        }
        if (this.cooldownTicks <= 0) {
            const repairRules = world.rules.general.repair;
            const repairRate = gameObject.rules.unitReload ? repairRules.reloadRate : repairRules.uRepairRate;
            this.cooldownTicks += GameSpeed.BASE_TICKS_PER_SECOND * repairRate * 60;
            let repairSuccessful = false;
            for (const unit of gameObject.dockTrait.getDockedUnits()) {
                if (unit.zone === ZoneType.Air)
                    continue;
                if (unit.healthTrait.health < 100 && world.areFriendly(unit, gameObject)) {
                    if (this.tickRepair(unit, world, gameObject)) {
                        repairSuccessful = true;
                    }
                    // 完善模拟层逻辑
                    // !e || (status !== Idle && lastSuccessful) || helipad || dispatch
                    // ⇒ dispatch when e && (status === Idle || !lastSuccessful) && !helipad
                    if (
                        repairSuccessful &&
                        (this.status === RepairStatus.Idle ||
                            !this.lastRepairTickSuccessful) &&
                        !gameObject.helipadTrait
                    ) {
                        world.events.dispatch(new UnitRepairStartEvent(unit));
                    }
                }
                else {
                    const rallyNode = gameObject.rallyTrait.findRallyNodeForUnit(unit, world.map);
                    if (rallyNode) {
                        gameObject.dockTrait.undockUnit(unit);
                        unit.unitOrderTrait.addTask(new MoveTask(world as any, rallyNode.tile, !!rallyNode.onBridge, {
                            closeEnoughTiles: world.rules.general.closeEnough
                        }));
                    }
                    if (!gameObject.helipadTrait) {
                        world.events.dispatch(new UnitRepairFinishEvent(unit, gameObject));
                    }
                }
            }
            this.lastRepairTickSuccessful = repairSuccessful;
            this.status = repairSuccessful ? RepairStatus.Repairing : RepairStatus.Idle;
        }
        else {
            this.cooldownTicks--;
        }
    }
    private tickRepair(unit: GameObject, world: World, repairBuilding: GameObject): boolean {
        const repairRules = world.rules.general.repair;
        const repairStep = Math.floor(repairRules.repairStep);
        const repairPercent = repairRules.repairPercent;
        let repairAmount: number;
        if (repairPercent) {
            const costPerHP = (repairPercent * unit.purchaseValue) / unit.healthTrait.maxHitPoints;
            const maxCost = Math.min(unit.owner.credits, Math.max(1, Math.floor(costPerHP * repairStep)));
            repairAmount = costPerHP && maxCost ? Math.floor(maxCost / costPerHP) : repairStep;
            if (!maxCost)
                return false;
            unit.owner.credits -= maxCost;
        }
        else {
            repairAmount = repairStep;
        }
        repairAmount = Math.min(repairAmount, unit.healthTrait.maxHitPoints - unit.healthTrait.getHitPoints());
        if (!repairAmount)
            return false;
        unit.healthTrait.healBy(repairAmount, repairBuilding, world);
        return true;
    }
    private computeDefaultRallyPoint(gameObject: GameObject, map: any): any {
        const foundation = gameObject.getFoundation();
        const rallyPos = new Vector2(gameObject.tile.rx, gameObject.tile.ry + foundation.height);
        return map.tiles.getByMapCoords(rallyPos.x, rallyPos.y) ?? gameObject.tile;
    }
}
