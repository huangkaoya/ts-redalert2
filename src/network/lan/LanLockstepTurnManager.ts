import { GameStatus } from '@/game/Game';
import { GameSpeed } from '@/game/GameSpeed';
import { ActionType } from '@/game/action/ActionType';
import { NoAction } from '@/game/action/NoAction';
import { Parser } from '@/network/gameopt/Parser';
import { Serializer } from '@/network/gameopt/Serializer';
import { LanMatchSession, LanResolvedTurn } from '@/network/lan/LanMatchSession';
import { EventDispatcher } from '@/util/event';

export class LanLockstepTurnManager {
    private readonly serializer = new Serializer();
    private readonly parser = new Parser();
    private readonly submittedTicks = new Set<number>();
    private gameTurnMillis = 1000 / GameSpeed.BASE_TICKS_PER_SECOND;
    private errorState = false;
    private passiveMode = false;
    private lagState = false;
    private matchDisposed = false;

    public readonly onActionsSent = new EventDispatcher<this, string>();
    public readonly onActionsReceived = new EventDispatcher<this, string>();
    public readonly onLagStateChange = new EventDispatcher<this, boolean>();

    constructor(
        private readonly game: any,
        private readonly localPlayer: any,
        private readonly inputActions: { dequeueAll(): any[] },
        private readonly actionFactory: any,
        private readonly matchSession: LanMatchSession,
        private readonly actionLogger?: { debug(message: string): void },
        private readonly lockstepLogger?: { debug?(message: string): void; warn?(message: string): void },
        private readonly replayRecorder?: { recordActions?(tick: number, actions: any[]): void; recordTick?(tick: number): void }
    ) { }

    init(): void {
        this.computeGameTurn(this.game.speed.value);
        this.matchSession.onActionsReceived.subscribe(this.handleActionsReceived);
    }

    getTurnMillis(): number {
        return this.gameTurnMillis;
    }

    setPassiveMode(passive: boolean): void {
        this.passiveMode = passive;
    }

    setErrorState(): void {
        this.errorState = true;
    }

    getErrorState(): boolean {
        return this.errorState;
    }

    doGameTurn(_timestamp: number): boolean {
        if (this.errorState) {
            return false;
        }

        const tick = this.game.currentTick;
        if (this.game.status !== GameStatus.Ended) {
            const localTurnId = this.submitLocalTurn(tick);
            if (localTurnId) {
                this.onActionsSent.dispatch(this, localTurnId);
            }

            const resolvedTurn = this.matchSession.tryConsumeTurn(tick);
            if (!resolvedTurn) {
                this.updateLagState(true, tick);
                return false;
            }

            this.updateLagState(false, tick);
            const processedActions = this.processResolvedTurn(tick, resolvedTurn);
            if (processedActions.length) {
                this.replayRecorder?.recordActions?.(tick, processedActions);
            }
            if (tick > 0 && tick % 300 === 0) {
                this.lockstepLogger?.debug?.(`[lan] tick=${tick} hash=${this.game.getHash()} peers=${resolvedTurn.batches.map((batch) => batch.peerId).join(',')}`);
            }
        }

        this.game.update();
        this.replayRecorder?.recordTick?.(this.game.currentTick - 1);
        return true;
    }

    dispose(): void {
        this.matchSession.onActionsReceived.unsubscribe(this.handleActionsReceived);
        if (!this.matchDisposed) {
            this.matchSession.dispose();
            this.matchDisposed = true;
        }
    }

    private readonly handleActionsReceived = (turnId: string) => {
        this.onActionsReceived.dispatch(this, turnId);
    };

    private computeGameTurn(speed: number): void {
        this.gameTurnMillis = 1000 / (speed * GameSpeed.BASE_TICKS_PER_SECOND);
    }

    private submitLocalTurn(tick: number): string | undefined {
        if (this.submittedTicks.has(tick)) {
            return undefined;
        }
        let actions = this.inputActions.dequeueAll();
        if (!actions.length) {
            actions = [new NoAction()];
        }

        const actionData = this.serializer.serializePlayerActions(actions.map((action: any) => ({
            id: action.actionType,
            params: action.serialize?.() ?? new Uint8Array(),
        })));

        this.submittedTicks.add(tick);
        return this.matchSession.submitLocalTurn(tick, actionData);
    }

    private processResolvedTurn(tick: number, resolvedTurn: LanResolvedTurn): any[] {
        const processedActions: any[] = [];

        resolvedTurn.batches.forEach((batch) => {
            const assignment = this.matchSession.getHumanAssignment(batch.peerId);
            if (!assignment) {
                return;
            }

            const player = this.game.getPlayerByName(assignment.name);
            const actionRecords = this.parser.parsePlayerActions(batch.actionData);
            actionRecords.forEach((record) => {
                const action = this.actionFactory.create(record.id);
                action.unserialize?.(record.params);
                action.player = player;
                action.process();
                processedActions.push(action);

                const printable = action.print?.();
                if (printable) {
                    this.actionLogger?.debug(`(${action.player.name})@${tick}: ${printable}`);
                }
            });
        });

        resolvedTurn.dropPeerIds.forEach((peerId) => {
            const assignment = this.matchSession.getHumanAssignment(peerId);
            if (!assignment) {
                return;
            }

            const player = this.game.getPlayerByName(assignment.name);
            const action = this.actionFactory.create(ActionType.DropPlayer);
            action.unserialize?.(new Uint8Array());
            action.player = player;
            action.process();
            processedActions.push(action);
            this.actionLogger?.debug(`(${player.name})@${tick}: [drop] peer disconnected`);
        });

        return processedActions;
    }

    private updateLagState(nextLagState: boolean, tick: number): void {
        if (this.lagState === nextLagState) {
            return;
        }
        this.lagState = nextLagState;
        this.onLagStateChange.dispatch(this, nextLagState);
        if (nextLagState) {
            this.lockstepLogger?.warn?.(`[lan] waiting for turn ${tick}${this.passiveMode ? ' (passive)' : ''}`);
        }
    }
}
