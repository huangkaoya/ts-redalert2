import { Building, BuildStatus } from "@/game/gameobject/Building";
import { NotifyTick } from "@/game/gameobject/trait/interface/NotifyTick";
import { ProductionQueue, QueueType, QueueStatus } from "@/game/player/production/ProductionQueue";
import { TechnoRules, FactoryType } from "@/game/rules/TechnoRules";
import { ExitFactoryTask } from "@/game/gameobject/task/move/ExitFactoryTask";
import { TerrainType } from "@/engine/type/TerrainType";
import { NotifySpawn } from "@/game/gameobject/trait/interface/NotifySpawn";
import { MoveTrait, MoveState } from "@/game/gameobject/trait/MoveTrait";
import { CardinalTileFinder } from "@/game/map/tileFinder/CardinalTileFinder";
import { DockTrait } from "@/game/gameobject/trait/DockTrait";
import { FactoryProduceUnitEvent } from "@/game/event/FactoryProduceUnitEvent";
import { Infantry } from "@/game/gameobject/Infantry";
import { TileOccupation, LayerType } from "@/game/map/TileOccupation";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { RadialTileFinder } from "@/game/map/tileFinder/RadialTileFinder";
import { NotifyWarpChange } from "@/game/gameobject/trait/interface/NotifyWarpChange";
import { VeteranLevel } from "@/game/gameobject/unit/VeteranLevel";
import { NotifyProduceUnit } from "@/game/trait/interface/NotifyProduceUnit";
import { Vector2 } from "@/game/math/Vector2";
import { NotifyOwnerChange } from "@/game/gameobject/trait/interface/NotifyOwnerChange";
import { NotifyDestroy } from "@/game/gameobject/trait/interface/NotifyDestroy";
import { DeathType } from "@/game/gameobject/common/DeathType";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { WaitMinutesTask } from "@/game/gameobject/task/system/WaitMinutesTask";
import { CallbackTask } from "@/game/gameobject/task/system/CallbackTask";
import { TaskGroup } from "@/game/gameobject/task/system/TaskGroup";
export enum FactoryStatus {
    Idle = 0,
    Delivering = 1
}
export class FactoryTrait {
    public type: FactoryType;
    public isCloningVats: boolean;
    public status: FactoryStatus;
    public deliveringUnit?: any;
    public buildingProductionTicks?: number;
    constructor(type: FactoryType, isCloningVats: boolean = false) {
        this.type = type;
        this.isCloningVats = isCloningVats;
        this.status = FactoryStatus.Idle;
    }
    [NotifySpawn.onSpawn](building: any, world: any): void {
        this.resetRallyPoint(building, world);
    }
    resetRallyPoint(building: any, world: any): void {
        if (![FactoryType.BuildingType, FactoryType.AircraftType].includes(this.type)) {
            const rallyPoint = this.computeDefaultRallyPoint(building, this.type, world.map);
            building.rallyTrait?.changeRallyPoint(rallyPoint, building, world);
        }
    }
    [NotifyWarpChange.onChange](building: any, oldValue: any, world: any): void {
        if (building.owner.production) {
            let queueTypes: QueueType[] = [];
            if (this.type === FactoryType.BuildingType) {
                queueTypes = [QueueType.Structures, QueueType.Armory];
            }
            else {
                queueTypes = [building.owner.production.getQueueTypeForFactory(this.type)];
            }
            for (const queueType of queueTypes) {
                building.owner.production.getQueue(queueType).notifyUpdated();
            }
        }
    }
    [NotifyOwnerChange.onChange](building: any, oldOwner: any, world: any): void {
        if (this.status === FactoryStatus.Delivering &&
            building.rules.deployTime &&
            this.deliveringUnit &&
            !this.deliveringUnit.isDestroyed &&
            this.unitIsInsideFactory(this.deliveringUnit, building, world)) {
            world.changeObjectOwner(this.deliveringUnit, building.owner);
        }
    }
    [NotifyDestroy.onDestroy](building: any, world: any, attacker: any, weapon: any): void {
        if (this.status === FactoryStatus.Delivering &&
            building.rules.deployTime &&
            this.deliveringUnit &&
            !this.deliveringUnit.isDestroyed &&
            building.deathType !== DeathType.Temporal &&
            this.unitIsInsideFactory(this.deliveringUnit, building, world)) {
            world.destroyObject(this.deliveringUnit, attacker, weapon);
        }
    }
    [NotifyTick.onTick](building: any, world: any): void {
        if (this.status === FactoryStatus.Delivering) {
            if (!this.deliveringUnit || this.deliveringUnit.isDestroyed) {
                this.buildingProductionTicks = this.buildingProductionTicks ?? 1;
                if (this.buildingProductionTicks-- > 0) {
                    return;
                }
                this.buildingProductionTicks = undefined;
            }
            else if (!this.unitHasClearedFactory(this.deliveringUnit, building, world)) {
                return;
            }
            this.status = FactoryStatus.Idle;
            this.deliveringUnit = undefined;
            return;
        }
        if (building.owner.production && !building.warpedOutTrait.isActive()) {
            const primaryFactory = building.owner.production.getPrimaryFactory(this.type);
            if ((primaryFactory?.warpedOutTrait.isActive() ||
                primaryFactory === building ||
                (primaryFactory?.factoryTrait?.deliveringUnit &&
                    primaryFactory.factoryTrait.type === FactoryType.UnitType)) &&
                this.type !== FactoryType.BuildingType) {
                const queue = building.owner.production.getQueueForFactory(this.type);
                if (queue && queue.status === QueueStatus.Ready) {
                    const item = queue.getFirst();
                    if (this.type === FactoryType.AircraftType) {
                        let produced = this.produceAircraftAt(building, item, world);
                        if (!produced) {
                            const otherAirports = [...building.owner.buildings].filter((b: any) => b.factoryTrait?.type === FactoryType.AircraftType && b.helipadTrait);
                            for (const airport of otherAirports) {
                                if (produced)
                                    break;
                                produced = this.produceAircraftAt(airport, item, world);
                            }
                        }
                        if (!produced)
                            return;
                    }
                    else {
                        this.produceGroundUnitAt(building, item, world);
                        if (!this.isCloningVats && this.type === FactoryType.InfantryType) {
                            const cloningVats = [...building.owner.buildings].filter((b: any) => b.factoryTrait && b.rules.cloning);
                            for (const vat of cloningVats) {
                                if (vat.factoryTrait.status === FactoryStatus.Idle) {
                                    vat.factoryTrait.produceGroundUnitAt(vat, item, world);
                                }
                            }
                        }
                    }
                    building.owner.addUnitsBuilt(item.rules, 1);
                    item.creditsSpent = 0;
                    item.progress = 0;
                    queue.shift(item.rules, 1);
                    if (queue.currentSize) {
                        queue.status = QueueStatus.Active;
                    }
                }
            }
        }
    }
    unitIsInsideFactory(unit: any, building: any, world: any): boolean {
        return world.map.tileOccupation.isTileOccupiedBy(unit.tile, building) &&
            unit.zone !== ZoneType.Air;
    }
    unitHasClearedFactory(unit: any, building: any, world: any): boolean {
        return !world.map.tileOccupation.isTileOccupiedBy(unit.tile, building) ||
            (unit.rules.consideredAircraft && unit.position.tileElevation >= building.art.height);
    }
    produceGroundUnitAt(building: any, item: any, world: any): void {
        const unit = world.createUnitForPlayer(item.rules, building.owner);
        if (item.rules.trainable && building.owner.canProduceVeteran(unit.rules)) {
            unit.veteranTrait?.setVeteranLevel(VeteranLevel.Veteran);
        }
        if (unit.isInfantry()) {
            unit.position.subCell = Infantry.SUB_CELLS[0];
        }
        let rallyPoint = this.computeInternalRallyPoint(building, this.type, building.rallyTrait.getRallyPoint(), world.map);
        if (this.type !== FactoryType.UnitType) {
            rallyPoint = building.rallyTrait.findRallyPointforUnit(unit, rallyPoint, world.map, false, building.tile.z);
        }
        let spawnTile: any;
        if (this.type === FactoryType.NavalUnitType) {
            spawnTile = rallyPoint;
        }
        else {
            const exitCoords = this.computeExitCoords(building, this.type);
            spawnTile = world.map.tiles.getByMapCoords(Math.floor(exitCoords.rx), Math.floor(exitCoords.ry));
        }
        if (unit.rules.consideredAircraft) {
            rallyPoint = spawnTile;
        }
        let rallyNode: any;
        if (building.rallyTrait.getRallyPoint() !== rallyPoint) {
            rallyNode = building.rallyTrait.findRallyNodeForUnit(unit, world.map);
        }
        if (unit.isInfantry()) {
            const occupiedSubCells = world.map.tileOccupation
                .getObjectsOnTileByLayer(rallyNode?.tile ?? rallyPoint, unit.rules.consideredAircraft ? LayerType.Air : LayerType.Ground)
                .filter((obj: any) => obj.isInfantry() && obj.moveTrait.moveState !== MoveState.Moving)
                .map((obj: any) => obj.position.subCell);
            unit.position.subCell = Infantry.SUB_CELLS.find(sc => !occupiedSubCells.includes(sc)) ?? Infantry.SUB_CELLS[0];
        }
        const createMoveTask = () => {
            if (unit.rules.consideredAircraft) {
                const target = rallyNode ?? { tile: rallyPoint, onBridge: undefined };
                unit.unitOrderTrait.addTaskNext(new MoveTask(world, target.tile, !!target.onBridge, {
                    closeEnoughTiles: world.rules.general.closeEnough
                }));
            }
            else {
                unit.unitOrderTrait.addTaskNext(new ExitFactoryTask(world, building, rallyPoint, rallyNode));
            }
        };
        unit.direction = 270;
        world.spawnObject(unit, spawnTile);
        world.traits.filter(NotifyProduceUnit).forEach((trait: any) => {
            trait[NotifyProduceUnit.onProduce](unit, world);
        });
        world.events.dispatch(new FactoryProduceUnitEvent(unit));
        if (building.rules.deployTime) {
            unit.unitOrderTrait.addTask(new TaskGroup(new WaitMinutesTask(building.rules.deployTime), new CallbackTask(() => {
                if (building.isSpawned && building.buildStatus !== BuildStatus.BuildDown) {
                    createMoveTask();
                }
            })).setCancellable(false));
        }
        else {
            createMoveTask();
        }
        this.status = FactoryStatus.Delivering;
        this.deliveringUnit = unit;
    }
    produceAircraftAt(building: any, item: any, world: any): boolean {
        const dockTrait = building.traits.find(DockTrait);
        if (!dockTrait)
            return false;
        const dockNumber = dockTrait.getFirstAvailableDockNumber();
        if (dockNumber === undefined)
            return false;
        const unit = world.createUnitForPlayer(item.rules, building.owner);
        if (item.rules.trainable && building.owner.canProduceVeteran(unit.rules)) {
            unit.veteranTrait?.setVeteranLevel(VeteranLevel.Veteran);
        }
        const dockOffset = dockTrait.getDockOffset(dockNumber);
        unit.position.moveToLeptons(building.position.getMapPosition());
        unit.position.moveByLeptons3(dockOffset);
        world.spawnObject(unit, unit.position.tile);
        dockTrait.dockUnitAt(unit, dockNumber);
        if (unit.isAircraft() && unit.airportBoundTrait) {
            unit.airportBoundTrait.preferredAirport = building;
        }
        world.traits.filter(NotifyProduceUnit).forEach((trait: any) => {
            trait[NotifyProduceUnit.onProduce](unit, world);
        });
        world.events.dispatch(new FactoryProduceUnitEvent(unit));
        return true;
    }
    computeExitCoords(building: any, factoryType: FactoryType): {
        rx: number;
        ry: number;
    } {
        if (factoryType === FactoryType.InfantryType) {
            return this.computeBarracksDefaultExitCoords(building);
        }
        if (factoryType === FactoryType.UnitType) {
            return this.computeWarFactoryExitCoords(building);
        }
        throw new Error("Unsupported factory type " + FactoryType[factoryType]);
    }
    computeInternalRallyPoint(building: any, factoryType: FactoryType, rallyPoint: any, map: any): any {
        let coords: {
            rx: number;
            ry: number;
        };
        let tile: any;
        if (factoryType === FactoryType.NavalUnitType) {
            tile = this.computeNavalInternalRallyPoint(building, rallyPoint, map);
        }
        else {
            if (factoryType === FactoryType.InfantryType) {
                coords = this.computeBarracksInternalRallyCoords(building);
            }
            else if (factoryType === FactoryType.UnitType) {
                coords = this.computeWarFactoryInternalRallyCoords(building);
            }
            else {
                throw new Error("Unsupported factory type " + FactoryType[factoryType]);
            }
            tile = map.tiles.getByMapCoords(coords.rx, coords.ry);
        }
        return tile ?? this.findTileAdjacentToBuilding(building, map);
    }
    computeDefaultRallyPoint(building: any, factoryType: FactoryType, map: any): any {
        let coords: {
            rx: number;
            ry: number;
        };
        let tile: any;
        if (factoryType === FactoryType.NavalUnitType) {
            tile = this.computeNavalDefaultRallyPoint(building, map);
        }
        else {
            if (factoryType === FactoryType.InfantryType) {
                coords = this.computeBarracksInternalRallyCoords(building);
            }
            else if (factoryType === FactoryType.UnitType) {
                coords = this.computeWarFactoryDefaultRallyCoords(building);
            }
            else {
                throw new Error("Unsupported factory type " + FactoryType[factoryType]);
            }
            tile = map.tiles.getByMapCoords(coords.rx, coords.ry);
        }
        return tile ?? this.findTileAdjacentToBuilding(building, map);
    }
    findTileAdjacentToBuilding(building: any, map: any): any {
        return new RadialTileFinder(map.tiles, map.mapBounds, building.tile, building.getFoundation(), 1, 1, () => true).getNextTile();
    }
    computeBarracksDefaultExitCoords(building: any): {
        rx: number;
        ry: number;
    } {
        const foundation = building.getFoundation();
        let x: number, y: number;
        if (foundation.width <= 2 || foundation.height <= 2) {
            x = foundation.width - 1;
            y = foundation.height - 1;
            if (building.rules.gdiBarracks && foundation.width > 2) {
                x = Math.floor(foundation.width / 2);
            }
        }
        else {
            x = 0;
            y = foundation.height - 1;
        }
        return { rx: building.tile.rx + x, ry: building.tile.ry + y };
    }
    computeBarracksInternalRallyCoords(building: any): {
        rx: number;
        ry: number;
    } {
        const foundation = building.getFoundation();
        let { rx, ry } = this.computeBarracksDefaultExitCoords(building);
        // 完善模拟层逻辑：!(w<=2||h<=2) || gdiBarracks → ry+=1; else nodBarracks offsets.
        if (!(foundation.width <= 2 || foundation.height <= 2) || building.rules.gdiBarracks) {
            ry += 1;
        }
        else if (building.rules.nodBarracks) {
            rx += foundation.width <= 2 ? 1 : 0;
            ry += foundation.height <= 2 ? 1 : 0;
        }
        return { rx, ry };
    }
    computeWarFactoryExitCoords(building: any): {
        rx: number;
        ry: number;
    } {
        const foundation = building.getFoundation();
        return {
            rx: building.tile.rx + Math.floor(foundation.width / 2),
            ry: building.tile.ry + Math.floor(foundation.height / 2)
        };
    }
    computeWarFactoryInternalRallyCoords(building: any): {
        rx: number;
        ry: number;
    } {
        const foundation = building.getFoundation();
        return {
            rx: building.tile.rx + foundation.width - 1,
            ry: building.tile.ry + Math.floor(foundation.height / 2)
        };
    }
    computeWarFactoryDefaultRallyCoords(building: any): {
        rx: number;
        ry: number;
    } {
        const foundation = building.getFoundation();
        return {
            rx: building.tile.rx + foundation.width,
            ry: building.tile.ry + Math.floor(foundation.height / 2)
        };
    }
    computeNavalDefaultRallyPoint(building: any, map: any): any {
        const finder = new CardinalTileFinder(map.tiles, map.mapBounds, building.centerTile, 5, 5, (tile: any) => tile.terrainType === TerrainType.Water &&
            !map.getObjectsOnTile(tile).find((obj: any) => obj.isBuilding() || (obj.isOverlay() && obj.isBridge())));
        finder.diagonal = false;
        return finder.getNextTile() ?? map.tiles.getByMapCoords(building.tile.rx + building.getFoundation().width, building.tile.ry + building.getFoundation().height);
    }
    computeNavalInternalRallyPoint(building: any, rallyPoint: any, map: any): any {
        const direction = new Vector2(rallyPoint.rx, rallyPoint.ry).sub(new Vector2(building.centerTile.rx, building.centerTile.ry));
        return map.tiles.getByMapCoords(building.centerTile.rx + Math.sign(direction.x) * (Math.floor(building.getFoundation().width / 2) + 1), building.centerTile.ry + Math.sign(direction.y) * (Math.floor(building.getFoundation().height / 2) + 1));
    }
}
