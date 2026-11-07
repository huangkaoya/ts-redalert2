import { NoAction } from '@/game/action/NoAction';
import { GameStatus } from '@/game/Game';
import { GameSpeed } from '@/game/GameSpeed';
import { EventDispatcher } from '@/util/event';

export class SoloPlayTurnManager {
    private gameTurnMillis = 1000 / GameSpeed.BASE_TICKS_PER_SECOND;
    private errorState = false;
    private gameSpeedChanged = false;
    public readonly onActionsSent = new EventDispatcher<this, void>();

    private readonly onGameSpeedChanged = () => {
        this.gameSpeedChanged = true;
    };

    constructor(
        private readonly game: any,
        private readonly currentPlayer: any,
        private readonly inputActions: { dequeueAll(): any[] },
        private readonly actionLogger?: { debug(message: string): void },
        private readonly replayRecorder?: { recordActions?(tick: number, actions: any[]): void; recordTick?(tick: number): void }
    ) { }

    init(): void {
        this.game.desiredSpeed.onChange.subscribe(this.onGameSpeedChanged);
        this.computeGameTurn(this.game.speed.value);
    }

    private computeGameTurn(speed: number): void {
        this.gameTurnMillis = 1000 / (speed * GameSpeed.BASE_TICKS_PER_SECOND);
    }

    setErrorState(): void {
        this.errorState = true;
    }

    getErrorState(): boolean {
        return this.errorState;
    }

    getTurnMillis(): number {
        return this.gameTurnMillis;
    }

    doGameTurn(_timestamp: number): boolean {
        if (this.errorState) {
            return false;
        }

        if (this.game.status !== GameStatus.Ended) {
            let actions = this.inputActions.dequeueAll();
            if (actions.length) {
                actions.forEach((action) => action.player = this.currentPlayer);
                this.replayRecorder?.recordActions?.(this.game.currentTick, actions);
                this.onActionsSent.dispatch(this);
            } else {
                actions = [new NoAction()];
            }
            this.processActions(actions);
        }

        this.game.update();
        this.replayRecorder?.recordTick?.(this.game.currentTick - 1);

        if (this.gameSpeedChanged) {
            this.game.speed.value = this.game.desiredSpeed.value;
            this.computeGameTurn(this.game.speed.value);
            this.gameSpeedChanged = false;
        }

        return true;
    }

    private processActions(actions: any[]): void {
        actions.forEach((action) => {
            action.player = this.currentPlayer;
            action.process();
            const printable = action.print?.();
            if (printable) {
                this.actionLogger?.debug(`(${action.player.name})@${this.game.currentTick}: ${printable}`);
            }
        });
    }

    dispose(): void {
        this.game.desiredSpeed.onChange.unsubscribe(this.onGameSpeedChanged);
    }
}
