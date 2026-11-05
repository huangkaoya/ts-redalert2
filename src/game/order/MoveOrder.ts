import { Order } from "@/game/order/Order";
import { OrderType } from "@/game/order/OrderType";
import { PointerType } from "@/engine/type/PointerType";
import { UndeployIntoTask } from "@/game/gameobject/task/morph/UndeployIntoTask";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { OrderFeedbackType } from "@/game/order/OrderFeedbackType";
import { RallyPointChangeEvent } from "@/game/event/RallyPointChangeEvent";
import { MovementZone } from "@/game/type/MovementZone";
import { SpeedType } from "@/game/type/SpeedType";
import { AttackTask } from "@/game/gameobject/task/AttackTask";
import { BuildStatus } from "@/game/gameobject/Building";
import { WaitForBuildUpTask } from "@/game/gameobject/task/WaitForBuildUpTask";
import { MoveToBlockTask } from "@/game/gameobject/task/move/MoveToBlockTask";
import { LandType } from "@/game/type/LandType";
import { AttackMoveTask } from "@/game/gameobject/task/move/AttackMoveTask";
import { AttackMoveTargetTask } from "@/game/gameobject/task/move/AttackMoveTargetTask";
import { MoveTargetTask } from "@/game/gameobject/task/move/MoveTargetTask";
export class MoveOrder extends Order {
    private game: any;
    private map: any;
    private unitSelection: any;
    private forceMove: boolean;
    public targetOptional: boolean = false;
    public feedbackType: OrderFeedbackType = OrderFeedbackType.Move;
    constructor(game: any, map: any, unitSelection: any, forceMove: boolean = false) {
        super(forceMove ? OrderType.ForceMove : OrderType.Move);
        this.game = game;
        this.map = map;
        this.unitSelection = unitSelection;
        this.forceMove = forceMove;
    }
    getPointerType(isMini: boolean): PointerType {
        let canMove = this.isAllowed();
        const isShrouded = !!this.game.mapShroudTrait
            .getPlayerShroud(this.sourceObject.owner)
            ?.isShrouded(this.target.tile, this.target.obj?.tileElevation);
        // 完善模拟层逻辑：only recompute passability when allowed, not force-move,
        // not a building order, and not shrouded. Otherwise keep isAllowed().
        if (canMove &&
            !this.forceMove &&
            !this.sourceObject.isBuilding() &&
            !isShrouded) {
            const hasBridge = !!this.target.getBridge();
            const speedType = this.sourceObject.rules.speedType;
            const isInfantry = this.sourceObject.isInfantry();
            const isFlying = this.sourceObject.rules.movementZone === MovementZone.Fly;
            const hasTerrainDisguise = this.map
                .getObjectsOnTile(this.target.tile)
                .some((obj: any) => (obj.isInfantry() || obj.isVehicle()) &&
                obj.disguiseTrait?.hasTerrainDisguise());
            if (isFlying) {
                canMove = this.sourceObject.rules.airportBound ||
                    this.target.tile.landType === LandType.Cliff ||
                    (this.map.terrain.getPassableSpeed(this.target.tile, SpeedType.Amphibious, false, hasBridge) > 0 && !hasTerrainDisguise);
            }
            else {
                canMove = this.map.terrain.getPassableSpeed(this.target.tile, speedType, isInfantry, hasBridge) > 0 &&
                    !hasTerrainDisguise &&
                    !(this.target.obj?.isTechno() &&
                        !this.game.areFriendly(this.target.obj, this.sourceObject));
            }
        }
        if (isMini) {
            return canMove ? PointerType.MoveMini : PointerType.NoActionMini;
        }
        else {
            return canMove ? PointerType.Move : PointerType.NoMove;
        }
    }
    isValid(): boolean {
        if (this.sourceObject.isBuilding() &&
            (!this.sourceObject.rules.undeploysInto ||
                (this.sourceObject.rules.constructionYard &&
                    !this.game.gameOpts.mcvRepacks)) &&
            !this.sourceObject.rallyTrait?.getRallyPoint()) {
            return false;
        }
        if (this.forceMove) {
            return true;
        }
        if (!this.target.obj) {
            return true;
        }
        if ((this.target.obj.isOverlay() || this.target.obj.isBuilding()) &&
            this.target.obj.rules.wall) {
            return true;
        }
        if (this.target.obj.isTechno() &&
            this.target.obj.owner === this.sourceObject.owner &&
            this.unitSelection.isSelected(this.target.obj)) {
            return true;
        }
        if ((this.target.obj.isInfantry() || this.target.obj.isVehicle()) &&
            !!this.target.obj.disguiseTrait?.hasTerrainDisguise()) {
            return true;
        }
        if (this.target.obj.isTechno() &&
            !this.game.areFriendly(this.target.obj, this.sourceObject)) {
            return true;
        }
        return false;
    }
    isAllowed(): boolean {
        if (this.sourceObject.isUnit() &&
            this.sourceObject.moveTrait.isDisabled()) {
            return false;
        }
        const isShrouded = this.game.mapShroudTrait
            .getPlayerShroud(this.sourceObject.owner)
            ?.isShrouded(this.target.tile, this.target.obj?.tileElevation);
        if (isShrouded) {
            return this.sourceObject.rules.moveToShroud;
        }
        if (!this.forceMove &&
            this.target.obj?.isTechno() &&
            this.target.obj.owner === this.sourceObject.owner &&
            this.unitSelection.isSelected(this.target.obj)) {
            return false;
        }
        return true;
    }
    process(): any[] | undefined {
        const sourceObject = this.sourceObject;
        if (sourceObject.isBuilding() && sourceObject.rallyTrait?.getRallyPoint()) {
            return undefined;
        }
        const closeEnoughTiles = this.game.rules.general.closeEnough;
        if (sourceObject.isBuilding() && sourceObject.rules.undeploysInto) {
            return [
                new UndeployIntoTask(this.game),
                new MoveTask(this.game, this.target.tile, !!this.target.getBridge(), { closeEnoughTiles, forceMove: this.forceMove })
            ];
        }
        if (sourceObject.isUnit()) {
            if (this.isEnemyBuildingBlock()) {
                return [new MoveToBlockTask(this.game, this.target.obj)];
            }
            if (this.isFollowMove()) {
                return [new MoveTargetTask(this.game, this.target.obj)];
            }
            return [
                new MoveTask(this.game, this.target.tile, !!this.target.getBridge(), { closeEnoughTiles, forceMove: this.forceMove })
            ];
        }
        return undefined;
    }
    private isEnemyBuildingBlock(): boolean {
        return this.forceMove &&
            this.sourceObject.isVehicle() &&
            !this.sourceObject.rules.consideredAircraft &&
            this.target.obj?.isBuilding() &&
            !this.game.areFriendly(this.sourceObject, this.target.obj);
    }
    private isFollowMove(): boolean {
        return this.forceMove &&
            this.target.obj?.isInfantry() &&
            this.sourceObject.isVehicle() &&
            !this.sourceObject.rules.consideredAircraft &&
            !this.target.obj.moveTrait.isIdle();
    }
    onAdd(tasks: any[], isQueued: boolean): boolean {
        const isUndeployableBuilding = this.sourceObject.isBuilding() &&
            this.sourceObject.rules.undeploysInto;
        if (isUndeployableBuilding &&
            this.sourceObject.buildStatus === BuildStatus.BuildUp) {
            const waitTask = this.sourceObject.unitOrderTrait
                .getTasks()
                .find((task: any) => task instanceof WaitForBuildUpTask);
            waitTask?.setCancellable(true);
            return true;
        }
        if (!isUndeployableBuilding &&
            this.sourceObject.isBuilding() &&
            this.sourceObject.rallyTrait?.getRallyPoint()) {
            this.sourceObject.rallyTrait.changeRallyPoint(this.target.tile, this.sourceObject, this.game);
            this.game.events.dispatch(new RallyPointChangeEvent(this.sourceObject));
            return false;
        }
        if (!this.isEnemyBuildingBlock() &&
            !this.isFollowMove() &&
            !isQueued &&
            this.isValid() &&
            this.isAllowed()) {
            this.sourceObject.attackTrait?.cancelOpportunityFire();
            const existingMoveTask = tasks.find((task: any) => task.constructor === MoveTask && !task.isCancelling());
            if (existingMoveTask) {
                existingMoveTask.setForceMove(this.forceMove);
                existingMoveTask.updateTarget(this.target.tile, !!this.target.getBridge(), true);
                if (existingMoveTask.children.length &&
                    existingMoveTask.children[0] instanceof AttackTask) {
                    existingMoveTask.children[0].cancel();
                }
                tasks.splice(tasks.indexOf(existingMoveTask) + 1);
                this.sourceObject.unitOrderTrait.clearOrders();
                return false;
            }
            if (this.sourceObject.isUnit() &&
                this.sourceObject.rules.movementZone === MovementZone.Fly) {
                const attackTask = tasks.find((task: any) => [AttackTask, AttackMoveTask, AttackMoveTargetTask]
                    .includes(task.constructor) && !task.isCancelling());
                if (attackTask && attackTask.forceCancel(this.sourceObject)) {
                    // 完善模拟层逻辑：splice(index) drops the cancelled task and everything after it.
                    tasks.splice(tasks.indexOf(attackTask));
                }
            }
        }
        return true;
    }
}
