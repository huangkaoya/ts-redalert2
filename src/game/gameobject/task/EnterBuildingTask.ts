import { Task } from './system/Task';
import { MoveOutsideTask } from './move/MoveOutsideTask';
import { MoveInsideTask } from './move/MoveInsideTask';
import { EnterObjectEvent } from '@/game/event/EnterObjectEvent';
import { MoveNextToTask } from '@/game/gameobject/task/move/MoveNextToTask';
import { RangeHelper } from '@/game/gameobject/unit/RangeHelper';

enum EnterBuildingState {
    Initial = 0,
    MovingNear = 1,
    WaitingForDelay = 2,
    MovingIn = 3,
    MovingOut = 4,
}

export class EnterBuildingTask extends Task {
    protected game: any;
    public target: any;
    protected enterDelaySeconds: number;
    private state: EnterBuildingState = EnterBuildingState.Initial;
    public preventOpportunityFire = false;
    private lastOutsideTile: any;
    private rangeHelper: RangeHelper;

    constructor(game: any, target: any, enterDelaySeconds = 0) {
        super();
        this.game = game;
        this.target = target;
        this.enterDelaySeconds = enterDelaySeconds;
        this.rangeHelper = new RangeHelper(this.game.map.tileOccupation);
    }

    onTick(unit: any): boolean {
        if ((this.isCancelling() && this.state === EnterBuildingState.Initial) || unit.moveTrait.isDisabled()) {
            return true;
        }
        if (this.state === EnterBuildingState.MovingOut) {
            return true;
        }
        if (this.state === EnterBuildingState.MovingIn && this.children.length) {
            if (
                unit.tile === this.lastOutsideTile ||
                this.game.map.tileOccupation.isTileOccupiedBy(unit.tile, this.target)
            ) {
                // keep lastOutsideTile
            } else {
                this.lastOutsideTile = unit.tile;
            }
            return false;
        }

        const needsApproachDelay = this.state !== EnterBuildingState.MovingIn && this.enterDelaySeconds > 0;
        const occupying = this.game.map.tileOccupation.isTileOccupiedBy(unit.tile, this.target);
        const inPosition = needsApproachDelay
            ? !occupying && this.rangeHelper.isInTileRange(unit.tile, this.target, 0, Math.SQRT2)
            : occupying;

        if (this.state === EnterBuildingState.Initial) {
            if (needsApproachDelay) {
                this.state = EnterBuildingState.MovingNear;
                if (!inPosition) {
                    this.children.push(new MoveNextToTask(this.game, this.target));
                    return false;
                }
            } else {
                this.state = EnterBuildingState.MovingIn;
                if (!inPosition) {
                    this.children.push(new MoveInsideTask(this.game, this.target).setBlocking(false));
                    this.preventOpportunityFire = true;
                    return false;
                }
            }
        }

        if (!inPosition) {
            return true;
        }

        if (!this.isAllowed(unit) || this.isCancelling()) {
            if (this.state === EnterBuildingState.MovingIn) {
                this.children.push(new MoveOutsideTask(this.game, this.target, this.lastOutsideTile));
                this.state = EnterBuildingState.MovingOut;
                return false;
            }
            return true;
        }

        if (this.state === EnterBuildingState.MovingNear) {
            this.lastOutsideTile = unit.tile;
            const cast = unit.castProgressTrait;
            if (!cast) {
                throw new Error('Enter delay requires a unit with a cast progress trait');
            }
            cast.reset();
            cast.start(this.enterDelaySeconds);
            this.state = EnterBuildingState.WaitingForDelay;
        }

        if (this.state !== EnterBuildingState.WaitingForDelay) {
            this.game.events.dispatch(new EnterObjectEvent(this.target, unit));
            if (this.onEnter(unit) === false) {
                this.children.push(new MoveOutsideTask(this.game, this.target, this.lastOutsideTile));
                this.state = EnterBuildingState.MovingOut;
                return false;
            }
            return true;
        }

        const cast = unit.castProgressTrait;
        if (!(cast.isCasting() || cast.isCompleted())) {
            cast.start(this.enterDelaySeconds);
        }
        if (cast.isCompleted()) {
            cast.reset();
            this.state = EnterBuildingState.MovingIn;
            this.children.push(new MoveInsideTask(this.game, this.target).setBlocking(false));
            this.preventOpportunityFire = true;
            return false;
        }
        return false;
    }

    onEnd(unit: any): void {
        unit.castProgressTrait?.reset();
    }

    getTargetLinesConfig(_unit: any) {
        return { target: this.target, pathNodes: [] };
    }

    protected isAllowed(_unit: any): boolean {
        return true;
    }

    protected onEnter(_unit: any): any {
        return true;
    }
}
