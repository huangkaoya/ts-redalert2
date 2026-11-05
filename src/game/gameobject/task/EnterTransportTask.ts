import { Task } from "@/game/gameobject/task/system/Task";
import { MoveOutsideTask } from "@/game/gameobject/task/move/MoveOutsideTask";
import { MoveInsideTask } from "@/game/gameobject/task/move/MoveInsideTask";
import { EnterTransportEvent } from "@/game/event/EnterTransportEvent";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { MoveState, MoveResult } from "@/game/gameobject/trait/MoveTrait";
import { RadialTileFinder } from "@/game/map/tileFinder/RadialTileFinder";
import { MovePositionHelper } from "@/game/gameobject/unit/MovePositionHelper";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { CallbackTask } from "@/game/gameobject/task/system/CallbackTask";
import { EnterObjectEvent } from "@/game/event/EnterObjectEvent";
enum EnterTransportState {
    MoveToQueueingTile = 0,
    WaitForTurn = 1,
    MoveToTransport = 2,
    EnterTransport = 3,
    ClearTransport = 4
}
interface QueueingNode {
    tile: any;
    onBridge: any;
}
export class EnterTransportTask extends Task {
    private game: any;
    public target: any;
    private movePerformed: boolean = false;
    private initialTargetTile: any;
    private state: EnterTransportState;
    private queueingNode?: QueueingNode;
    constructor(game: any, target: any) {
        super();
        this.game = game;
        this.target = target;
        this.preventOpportunityFire = false;
    }
    isAllowed(unit: any): boolean {
        return (!this.target.isDestroyed &&
            !this.target.isCrashing &&
            this.game.areFriendly(this.target, unit) &&
            unit.zone !== ZoneType.Air &&
            this.target.zone !== ZoneType.Air &&
            this.target.transportTrait.unitFitsInside(unit) &&
            this.target.moveTrait.moveState === MoveState.Idle &&
            !this.target.warpedOutTrait.isActive() &&
            !unit.mindControllableTrait?.isActive() &&
            !unit.mindControllerTrait?.isActive());
    }
    onStart(unit: any): void {
        if (!this.target.transportTrait) {
            throw new Error(`Unit ${this.target.name} is not a valid transport`);
        }
        this.initialTargetTile = this.target.tile;
        if (this.target.transportTrait.addToLoadQueue(unit) > 0) {
            this.state = EnterTransportState.MoveToQueueingTile;
        }
        else {
            this.state = EnterTransportState.MoveToTransport;
        }
    }
    onEnd(unit: any): void {
        if (!this.target.isDestroyed) {
            this.target.transportTrait?.removeFromLoadQueue(unit);
        }
    }
    onTick(unit: any): boolean {
        if ((this.isCancelling() && this.state !== EnterTransportState.EnterTransport) ||
            this.state === EnterTransportState.ClearTransport ||
            unit.moveTrait.isDisabled()) {
            return true;
        }
        if (this.target.tile !== this.initialTargetTile ||
            this.target.moveTrait.moveState !== MoveState.Idle) {
            return true;
        }
        if (this.state === EnterTransportState.MoveToQueueingTile) {
            const moveHelper = new MovePositionHelper(this.game.map);
            const targetBridge = this.target.onBridge
                ? this.game.map.tileOccupation.getBridgeOnTile(this.target.tile)
                : undefined;
            let selectedBridge: any;
            const queueingTile = new RadialTileFinder(this.game.map.tiles, this.game.map.mapBounds, this.target.tile, this.target.getFoundation(), 1, 1, (tile: any) => {
                const bridges = [this.game.map.tileOccupation.getBridgeOnTile(tile)];
                if (bridges[0])
                    bridges.push(undefined);
                for (const bridge of bridges) {
                    if (this.game.map.terrain.getPassableSpeed(tile, unit.rules.speedType, unit.isInfantry(), !!bridge) > 0 &&
                        moveHelper.isEligibleTile(tile, bridge, targetBridge, this.target.tile)) {
                        selectedBridge = bridge;
                        return true;
                    }
                }
                return false;
            }).getNextTile();
            if (!queueingTile) {
                return true;
            }
            this.children.push(new MoveTask(this.game, queueingTile, !!selectedBridge, {
                closeEnoughTiles: 5
            }));
            this.children.push(new CallbackTask(() => {
                if (![MoveResult.Success, MoveResult.CloseEnough].includes(unit.moveTrait.lastMoveResult)) {
                    this.cancel();
                }
            }));
            this.queueingNode = { tile: queueingTile, onBridge: selectedBridge };
            this.state = EnterTransportState.WaitForTurn;
            return false;
        }
        if (this.state === EnterTransportState.WaitForTurn) {
            if (!this.target.transportTrait.unitIsFirstInLoadQueue(unit)) {
                return false;
            }
            this.queueingNode = undefined;
            this.state = EnterTransportState.MoveToTransport;
        }
        if (this.state === EnterTransportState.MoveToTransport) {
            if (!this.isAllowed(unit)) {
                return true;
            }
            // 完善模拟层逻辑：only isTileOccupiedBy (coordinate occupancy), no onBridge layer gate.
            if (!this.game.map.tileOccupation.isTileOccupiedBy(unit.tile, this.target)) {
                if (this.movePerformed) {
                    return true;
                }
                this.children.push(new MoveInsideTask(this.game, this.target));
                this.movePerformed = true;
                this.preventOpportunityFire = true;
                return false;
            }
            this.state = EnterTransportState.EnterTransport;
        }
        if (this.state === EnterTransportState.EnterTransport) {
            if (!this.isAllowed(unit) || this.isCancelling()) {
                this.children.push(new MoveOutsideTask(this.game, this.target));
                this.state = EnterTransportState.ClearTransport;
                return false;
            }
            this.game.limboObject(unit, {
                selected: false,
                controlGroup: this.game
                    .getUnitSelection()
                    .getOrCreateSelectionModel(unit)
                    .getControlGroupNumber(),
                inTransport: true
            });
            this.game.events.dispatch(new EnterTransportEvent(this.target));
            this.game.events.dispatch(new EnterObjectEvent(this.target, unit));
            this.target.transportTrait.units.push(unit);
            return true;
        }
        return false;
    }
    getTargetLinesConfig(unit: any) {
        return {
            target: this.queueingNode ? undefined : this.target,
            pathNodes: this.queueingNode ? [this.queueingNode] : []
        };
    }
}
