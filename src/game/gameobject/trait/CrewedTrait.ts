import { NotifySell } from "@/game/gameobject/trait/interface/NotifySell";
import { NotifyDestroy } from "@/game/gameobject/trait/interface/NotifyDestroy";
import { SideType } from "@/game/SideType";
import { ObjectType } from "@/engine/type/ObjectType";
import { ScatterTask } from "@/game/gameobject/task/ScatterTask";
import { Infantry } from "@/game/gameobject/Infantry";
import { VeteranLevel } from "@/game/gameobject/unit/VeteranLevel";
export class CrewedTrait {
    [NotifySell.onSell](target: any, context: any): void {
        this.spawnSurvivors(target, context);
    }
    [NotifyDestroy.onDestroy](target: any, context: any, damageInfo: any, isSell: boolean): void {
        if (!isSell &&
            !(damageInfo?.obj === target && damageInfo.weapon?.rules.suicide) &&
            !(target.isVehicle() && target.moveTrait.isMoving()) &&
            !target.crashableTrait) {
            this.spawnSurvivors(target, context);
        }
    }
    private spawnSurvivors(target: any, context: any): void {
        const crewRules = context.rules.general.crew;
        const side = target.owner.country.side;
        let survivorDivisor: number;
        let crewType: string;
        if (side === SideType.GDI) {
            survivorDivisor = crewRules.alliedSurvivorDivisor;
            crewType = crewRules.alliedCrew;
        }
        else if (side === SideType.Nod) {
            survivorDivisor = crewRules.sovietSurvivorDivisor;
            crewType = crewRules.sovietCrew;
        }
        else if (side === SideType.ThirdSide) {
            survivorDivisor = crewRules.thirdSurvivorDivisor;
            crewType = crewRules.thirdCrew;
        }
        else {
            return;
        }
        let survivorCount = context.sellTrait.computeRefundValue(target) / survivorDivisor;
        survivorCount = survivorCount > 0 && survivorCount < 1 ? 1 : Math.floor(survivorCount);
        survivorCount = target.isVehicle() ? Math.min(1, survivorCount) : Math.min(5, survivorCount);
        const crewTypes: string[] = [];
        for (let i = 0; i < survivorCount; i++) {
            crewTypes.push(crewType);
        }
        if (crewTypes.length > 0) {
            if (target.rules.constructionYard) {
                crewTypes[crewTypes.length - 1] = context.rules.general.engineer;
            }
            const validTiles = context.map.tiles
                .getInRectangle(target.tile, target.getFoundation())
                .filter((tile: any) => context.map.isWithinBounds(tile));
            let availableTiles = [...validTiles];
            for (const crewType of crewTypes) {
                const infantryRules = context.rules.getObject(crewType, ObjectType.Infantry);
                if (context.map.terrain.getPassableSpeed(target.tile, infantryRules.speedType, true, !target.isBuilding() && target.onBridge, undefined, true)) {
                    const unit = context.createUnitForPlayer(infantryRules, target.owner);
                    let spawnTile = availableTiles.length
                        ? availableTiles.splice(context.generateRandomInt(0, availableTiles.length - 1), 1)[0]
                        : undefined;
                    spawnTile = spawnTile || validTiles[context.generateRandomInt(0, validTiles.length - 1)];
                    if (unit.isInfantry()) {
                        unit.position.subCell = Infantry.SUB_CELLS[0];
                    }
                    if (unit.veteranTrait && target.owner.canProduceVeteran(unit.rules)) {
                        unit.veteranTrait.setVeteranLevel(VeteranLevel.Veteran);
                    }
                    context.spawnObject(unit, spawnTile);
                    if (target.isBuilding()) {
                        unit.unitOrderTrait.addTask(new ScatterTask(context, undefined, {
                            ignoredBlockers: target.isDestroyed ? undefined : [target]
                        }));
                    }
                }
            }
        }
    }
}
