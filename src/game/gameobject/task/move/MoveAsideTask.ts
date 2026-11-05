import { Task } from "@/game/gameobject/task/system/Task";
import { MovePositionHelper } from "@/game/gameobject/unit/MovePositionHelper";
import { WaitTicksTask } from "@/game/gameobject/task/system/WaitTicksTask";
import { MoveTrait, CollisionState, MoveState } from "@/game/gameobject/trait/MoveTrait";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { rotateVec2 } from "@/game/math/geometry";
import { MovementZone } from "@/game/type/MovementZone";
import { StanceType } from "@/game/gameobject/infantry/StanceType";
export class MoveAsideTask extends Task {
    private game: any;
    private fromDirection: any;
    private resolved: boolean = false;
    private chainPushIssued: boolean = false;
    private timeoutTicks?: number;
    constructor(game: any, fromDirection: any) {
        super();
        this.game = game;
        this.fromDirection = fromDirection;
    }
    onEnd(unit: any): void {
        unit.moveTrait.collisionState = CollisionState.Resolved;
    }
    onTick(unit: any): boolean {
        this.timeoutTicks = this.timeoutTicks === undefined ? 0 : this.timeoutTicks + 1;
        if (this.timeoutTicks > 40 || this.resolved || this.isCancelling()) {
            return true;
        }
        const map = this.game.map;
        const moveHelper = new MovePositionHelper(map);
        const bridge = unit.onBridge ? map.tileOccupation.getBridgeOnTile(unit.tile) : undefined;
        let targetTile: any;
        let targetBridge: any;
        for (let angle = 0; angle < 360; angle += 45) {
            if ((angle !== 0 || this.chainPushIssued) && angle !== 180) {
                const direction = rotateVec2(this.fromDirection.clone(), angle).round();
                const tile = map.tiles.getByMapCoords(unit.tile.rx + Math.sign(direction.x), unit.tile.ry + Math.sign(direction.y));
                if (tile && map.mapBounds.isWithinBounds(tile)) {
                    targetBridge = map.tileOccupation.getBridgeOnTile(tile);
                    if (unit.rules.movementZone === MovementZone.Fly ||
                        (!map.terrain.findObstacles({ tile, onBridge: targetBridge }, unit).length &&
                            moveHelper.isEligibleTile(tile, targetBridge, bridge, unit.tile))) {
                        targetTile = tile;
                        break;
                    }
                }
            }
        }
        if (targetTile) {
            this.resolved = true;
            if (unit.isInfantry() && unit.deployerTrait && unit.deployerTrait.isDeployed()) {
                unit.deployerTrait.setDeployed(false);
            }
            if (unit.moveTrait.isDisabled()) {
                return true;
            }
            this.children.push(new MoveTask(this.game, targetTile, !!targetBridge, {
                closeEnoughTiles: 0,
                strictCloseEnough: true
            }));
            return false;
        }
        if (this.chainPushIssued) {
            this.children.push(new WaitTicksTask(5));
            return false;
        }
        const pushTile = map.tiles.getByMapCoords(unit.tile.rx + Math.sign(this.fromDirection.x), unit.tile.ry + Math.sign(this.fromDirection.y));
        if (!pushTile || !map.mapBounds.isWithinBounds(pushTile)) {
            return true;
        }
        targetBridge = map.tileOccupation.getBridgeOnTile(pushTile);
        const pushableUnits = map.tileOccupation.getGroundObjectsOnTile(pushTile).filter((other: any) => other.isUnit() &&
            other.owner === unit.owner &&
            other.tile === pushTile &&
            other.onBridge === !!targetBridge &&
            !(other.isInfantry() && other.stance === StanceType.Paradrop) &&
            !(other.isAircraft() && other.missileSpawnTrait));
        if (pushableUnits.find((other: any) => other.moveTrait.collisionState === CollisionState.Waiting ||
            other.unitOrderTrait.hasTasks())) {
            this.children.push(new WaitTicksTask(5));
            unit.moveTrait.collisionState = CollisionState.Waiting;
            unit.moveTrait.moveState = MoveState.PlanMove;
            return false;
        }
        pushableUnits.forEach((other: any) => {
            other.unitOrderTrait.addTask(new MoveAsideTask(this.game, this.fromDirection));
        });
        this.children.push(new WaitTicksTask(1));
        unit.moveTrait.collisionState = CollisionState.Waiting;
        unit.moveTrait.moveState = MoveState.PlanMove;
        this.chainPushIssued = true;
        return false;
    }
}
