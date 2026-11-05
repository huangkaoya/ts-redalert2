import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { NotifyTick } from "@/game/gameobject/trait/interface/NotifyTick";
import { NotifyDestroy } from "@/game/gameobject/trait/interface/NotifyDestroy";
import { ZoneType, getZoneType } from "@/game/gameobject/unit/ZoneType";
import { InfDeathType } from "@/game/gameobject/infantry/InfDeathType";
import { ObjectTeleportEvent } from "@/game/event/ObjectTeleportEvent";
import { DeathType } from "@/game/gameobject/common/DeathType";
import { NotifyTeleport } from "@/game/gameobject/trait/interface/NotifyTeleport";
import { LocomotorType } from "@/game/type/LocomotorType";
import { JumpjetLocomotor } from "@/game/gameobject/locomotor/JumpjetLocomotor";
import { SpeedType } from "@/game/type/SpeedType";
import { WingedLocomotor } from "@/game/gameobject/locomotor/WingedLocomotor";
import { StanceType } from "@/game/gameobject/infantry/StanceType";
import { NotifyTileChange as GlobalNotifyTileChange } from "@/game/trait/interface/NotifyTileChange";
import { NotifyTileChange } from "@/game/gameobject/trait/interface/NotifyTileChange";
import { EnterTileEvent } from "@/game/event/EnterTileEvent";
import { Vector3 } from "@/game/math/Vector3";
import { NotifyElevationChange } from "@/game/trait/interface/NotifyElevationChange";
interface GameObject {
    rules: any;
    veteranTrait?: any;
    crateBonuses: any;
    healthTrait: any;
    position: any;
    tile: any;
    tileElevation: number;
    direction: number;
    zone: ZoneType;
    onBridge: boolean;
    owner: any;
    crusher: boolean;
    spinVelocity: number;
    traits: any[];
    turretTrait?: any;
    attackTrait?: any;
    unitOrderTrait: any;
    moveTrait: MoveTrait;
    stance?: StanceType;
    infDeathType?: InfDeathType;
    deathType?: DeathType;
    isDestroyed: boolean;
    isVehicle(): boolean;
    isAircraft(): boolean;
    isUnit(): boolean;
    isInfantry(): boolean;
    isTechno(): boolean;
    isOverlay(): boolean;
    applyRocking(x: number, y: number): void;
}
interface TileOccupation {
    unoccupyTileRange(tile: any, obj: GameObject): void;
    occupyTileRange(tile: any, obj: GameObject): void;
    getBridgeOnTile(tile: any): any;
    getGroundObjectsOnTile(tile: any): GameObject[];
    unoccupySingleTile(tile: any, obj: GameObject): void;
}
interface GameState {
    currentTick: number;
    map: any;
    rules: any;
    events: any;
    traits: any[];
    crateGeneratorTrait: any;
    areFriendly(a: GameObject, b: GameObject): boolean;
    destroyObject(obj: GameObject, source: any): void;
}
interface Task {
    children: Task[];
}
interface PathNode {
    tile: any;
}
interface Waypoint {
}
export enum MoveState {
    Idle = 0,
    ReachedNextWaypoint = 1,
    PlanMove = 2,
    Moving = 3
}
export enum MoveResult {
    Success = 0,
    Cancel = 1,
    CloseEnough = 2,
    Fail = 3
}
export enum CollisionState {
    Waiting = 0,
    Resolved = 1
}
const isMoveTask = (task: Task): boolean => {
    return task instanceof MoveTask || (task.children[0] && isMoveTask(task.children[0]));
};
export class MoveTrait {
    private gameObject: GameObject;
    private tileOccupation: TileOccupation;
    private disabled: boolean = false;
    private speedPenalty: number = 0;
    private velocity: Vector3 = new Vector3();
    private reservedPathNodes: PathNode[] = [];
    private moveState: MoveState = MoveState.Idle;
    private collisionState: CollisionState = CollisionState.Resolved;
    private locomotor?: any;
    private currentWaypoint?: Waypoint;
    private lastTargetOffset?: any;
    private lastVelocity?: Vector3;
    private lastMoveResult?: MoveResult;
    private lastTeleportTick?: number;
    get baseSpeed(): number {
        return (this.gameObject.rules.speed *
            (this.gameObject.veteranTrait?.getVeteranSpeedMultiplier() ?? 1) *
            this.gameObject.crateBonuses.speed *
            (this.gameObject.isVehicle() &&
                this.gameObject.healthTrait.health <= 50 &&
                this.gameObject.rules.locomotor !== LocomotorType.Hover
                ? 0.75
                : 1) *
            (1 - this.speedPenalty));
    }
    constructor(gameObject: GameObject, tileOccupation: TileOccupation) {
        this.gameObject = gameObject;
        this.tileOccupation = tileOccupation;
    }
    isDisabled(): boolean {
        return this.disabled;
    }
    setDisabled(disabled: boolean): void {
        this.disabled = disabled;
    }
    isMoving(): boolean {
        return this.moveState === MoveState.Moving;
    }
    isIdle(): boolean {
        return this.moveState === MoveState.Idle;
    }
    isWaiting(): boolean {
        return this.collisionState === CollisionState.Waiting;
    }
    [NotifyTick.onTick](gameObject: GameObject, gameState: GameState): void {
        if (this.moveState !== MoveState.Idle && this.collisionState === CollisionState.Resolved) {
            const currentTask = gameObject.unitOrderTrait.getCurrentTask();
            if (!(currentTask && isMoveTask(currentTask))) {
                this.velocity.set(0, 0, 0);
                this.moveState = MoveState.Idle;
                this.locomotor = undefined;
                if (!currentTask &&
                    !gameObject.attackTrait?.currentTarget &&
                    gameObject.isVehicle() &&
                    gameObject.turretTrait) {
                    gameObject.turretTrait.desiredFacing = gameObject.direction;
                }
            }
        }
        if (this.moveState === MoveState.Idle) {
            if (gameObject.rules.locomotor === LocomotorType.Jumpjet) {
                JumpjetLocomotor.tickStationary(gameObject as any, gameState as any);
            }
            else if (gameObject.isAircraft() &&
                gameObject.rules.locomotor === LocomotorType.Aircraft) {
                WingedLocomotor.tickStationary(gameObject as any, gameState as any);
            }
        }
    }
    [NotifyDestroy.onDestroy](gameObject: GameObject, gameState: GameState): void {
        this.unreservePathNodes();
    }
    teleportUnitToTile(targetTile: any, bridge: any, fromTile: any, preserveMovement: boolean, gameState: GameState): void {
        const gameObject = this.gameObject;
        const oldTile = gameObject.tile;
        (gameObject.traits as any)
            .filter(NotifyTeleport)
            .forEach((trait: any) => {
            trait[NotifyTeleport.onBeforeTeleport](gameObject, gameState, fromTile, preserveMovement);
        });
        gameObject.position.tileElevation = gameObject.tileElevation;
        gameObject.position.tile = targetTile;
        gameObject.position.subCell = gameObject.position.desiredSubCell;
        this.handleTileChange(oldTile, bridge, true, gameState, true);
        if (!preserveMovement) {
            this.unreservePathNodes();
            this.speedPenalty = 0;
            this.velocity.set(0, 0, 0);
            this.moveState = MoveState.Idle;
            this.collisionState = CollisionState.Resolved;
            this.locomotor = undefined;
            this.currentWaypoint = undefined;
            this.lastTargetOffset = undefined;
            this.lastVelocity = undefined;
            this.lastMoveResult = MoveResult.Cancel;
            if (gameObject.isVehicle()) {
                gameObject.spinVelocity = 0;
                if (gameObject.turretTrait) {
                    gameObject.turretTrait.desiredFacing = gameObject.direction;
                }
            }
        }
        this.lastTeleportTick = gameState.currentTick;
        gameState.events.dispatch(new ObjectTeleportEvent(gameObject, fromTile, oldTile));
    }
    handleTileChange(oldTile: any, bridge: any, teleporting: boolean, gameState: GameState, isTeleport: boolean = false): void {
        const gameObject = this.gameObject;
        gameState.map.tileOccupation.unoccupyTileRange(oldTile, gameObject);
        gameState.map.tileOccupation.occupyTileRange(gameObject.tile, gameObject);
        gameState.map.technosByTile.updateObject(gameObject);
        if (gameObject.zone !== ZoneType.Air) {
            const oldBridge = gameObject.onBridge ?
                gameState.map.tileOccupation.getBridgeOnTile(oldTile) : undefined;
            const oldLandType = gameObject.onBridge ?
                oldTile.onBridgeLandType : oldTile.landType;
            const newLandType = bridge ?
                gameObject.tile.onBridgeLandType : gameObject.tile.landType;
            if (oldLandType !== newLandType) {
                const speedModifier = gameState.rules
                    .getLandRules(newLandType)
                    .getSpeedModifier(gameObject.rules.speedType);
                if (speedModifier > 0 ||
                    gameObject.rules.speedType === SpeedType.Amphibious ||
                    isTeleport) {
                    gameObject.zone = getZoneType(newLandType);
                }
            }
            if (bridge !== oldBridge) {
                gameObject.position.tileElevation +=
                    -(oldBridge?.tileElevation ?? 0) + (bridge?.tileElevation ?? 0);
                gameObject.onBridge = !!bridge;
            }
            const nodeIndex = gameObject.moveTrait.reservedPathNodes.findIndex(node => node.tile === gameObject.tile);
            if (nodeIndex !== -1) {
                gameObject.moveTrait.reservedPathNodes.splice(nodeIndex, 1);
            }
            if (gameObject.crusher) {
                const crushableObjects = gameState.map
                    .getGroundObjectsOnTile(gameObject.tile)
                    .filter(obj => (!obj.isUnit() || obj.onBridge === gameObject.onBridge) &&
                    obj.rules.crushable &&
                    !(obj.isInfantry() && obj.stance === StanceType.Paradrop) &&
                    (!(obj.isTechno() && !teleporting) || !gameState.areFriendly(obj, gameObject)));
                for (const crushable of crushableObjects) {
                    if (!crushable.isDestroyed) {
                        if (crushable.isInfantry()) {
                            crushable.infDeathType = InfDeathType.None;
                        }
                        if (gameObject.isVehicle() &&
                            crushable.isOverlay() &&
                            crushable.rules.wall) {
                            gameObject.applyRocking(0, 0.5);
                        }
                        crushable.deathType = DeathType.Crush;
                        gameState.destroyObject(crushable, { player: gameObject.owner, obj: gameObject });
                    }
                }
            }
            if (!gameObject.onBridge) {
                const crate = gameState.map.tileOccupation
                    .getGroundObjectsOnTile(gameObject.tile)
                    .find(obj => obj.isOverlay() && obj.rules.crate);
                if (crate) {
                    gameState.crateGeneratorTrait.pickupCrate(gameObject, crate, gameState);
                }
            }
        }
        (gameState.traits as any)
            .filter(GlobalNotifyTileChange)
            .forEach((trait: any) => {
            trait[GlobalNotifyTileChange.onTileChange](gameObject, gameState, oldTile, isTeleport);
        });
        (gameObject.traits as any)
            .filter(NotifyTileChange)
            .forEach((trait: any) => {
            trait[NotifyTileChange.onTileChange](gameObject, gameState, oldTile, isTeleport);
        });
        gameState.events.dispatch(new EnterTileEvent(gameObject.tile, gameObject));
    }
    handleElevationChange(oldElevation: number, gameState: GameState): void {
        (gameState.traits as any)
            .filter(NotifyElevationChange)
            .forEach((trait: any) => {
            trait[NotifyElevationChange.onElevationChange](this.gameObject, gameState, oldElevation);
        });
    }
    unreservePathNodes(): void {
        this.reservedPathNodes.forEach(node => {
            if (node.tile !== this.gameObject.tile) {
                this.tileOccupation.unoccupySingleTile(node.tile, this.gameObject);
            }
        });
        this.reservedPathNodes.length = 0;
    }
    dispose(): void {
        this.gameObject = undefined as any;
    }
}
