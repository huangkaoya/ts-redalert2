import { ActionRecord, ReplayEventRecord, ReplayEventType, HashCheckpoint } from './Replay';
import { ChatMessageReplayEvent } from './replay/ChatMessageReplayEvent';
import { TauntReplayEvent } from './replay/TauntReplayEvent';
import { GameSpeed } from '@/game/GameSpeed';
import { EventDispatcher } from '@/util/event';

export class ReplayTurnManager {
    private gameTurnMillis = 1000 / GameSpeed.BASE_TICKS_PER_SECOND;
    private errorState = false;
    private gameSpeedChanged = false;
    private finished = false;

    private actionsByTick: Map<number, ActionRecord[]>;
    private eventsByTick: Map<number, ReplayEventRecord[]>;
    private hashByTick: Map<number, number>;

    public readonly onReplayEvent = new EventDispatcher<this, any>();
    public readonly onActionsSent = new EventDispatcher<this, void>();
    public readonly onFinished = new EventDispatcher<this, void>();

    private readonly onGameSpeedChanged = () => {
        this.gameSpeedChanged = true;
    };

    constructor(
        private readonly game: any,
        private readonly replay: any,
        private readonly actionFactory: any,
        private readonly actionLogger?: { debug(message: string): void },
    ) {
        this.actionsByTick = this.buildTickMap<ActionRecord>(replay.actionRecords ?? [], r => r.tick);
        this.eventsByTick = this.buildTickMap<ReplayEventRecord>(replay.eventRecords ?? [], r => r.tick);
        this.hashByTick = new Map<number, number>();
        for (const cp of (replay.hashCheckpoints ?? []) as HashCheckpoint[]) {
            this.hashByTick.set(cp.tick, cp.hash);
        }
    }

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

    isFinished(): boolean {
        return this.finished;
    }

    doGameTurn(_timestamp: number): boolean {
        if (this.errorState || this.finished) {
            return false;
        }

        const tick = this.game.currentTick;

        // Inject actions for this tick
        const records = this.actionsByTick.get(tick);
        if (records) {
            for (const record of records) {
                const action = this.actionFactory.create(record.actionType);
                action.unserialize(record.data);
                action.player = this.game.getPlayer(record.playerId);
                action.process();

                const printable = action.print?.();
                if (printable) {
                    this.actionLogger?.debug(`[replay](${action.player?.name})@${tick}: ${printable}`);
                }
            }
            this.onActionsSent.dispatch(this);
        }

        // Dispatch replay events for this tick
        const events = this.eventsByTick.get(tick);
        if (events) {
            for (const event of events) {
                if (event.type === ReplayEventType.Chat) {
                    this.onReplayEvent.dispatch(this, new ChatMessageReplayEvent({
                        playerId: event.playerId,
                        message: event.payload,
                    }));
                } else if (event.type === ReplayEventType.Taunt) {
                    this.onReplayEvent.dispatch(this, new TauntReplayEvent({
                        playerId: event.playerId,
                        tauntNo: parseInt(event.payload, 10),
                    }));
                }
            }
        }

        // Match the live client's lockstep order: apply actions and side-channel
        // events for this tick before advancing the simulation.
        this.game.update();

        // Verify hash checkpoint
        const expectedHash = this.hashByTick.get(tick);
        if (expectedHash !== undefined) {
            const actualHash = this.game.getHash();
            if (actualHash !== expectedHash) {
                console.warn(`[ReplayTurnManager] Desync detected at tick ${tick}: expected=${expectedHash}, actual=${actualHash}`);
            }
        }

        // Handle game speed changes
        if (this.gameSpeedChanged) {
            this.game.speed.value = this.game.desiredSpeed.value;
            this.computeGameTurn(this.game.speed.value);
            this.gameSpeedChanged = false;
        }

        // Check if replay has ended
        if (tick >= this.replay.finishedTick) {
            this.finished = true;
            this.onFinished.dispatch(this, undefined);
            return false;
        }

        return true;
    }

    dispose(): void {
        this.game.desiredSpeed.onChange.unsubscribe(this.onGameSpeedChanged);
    }

    private buildTickMap<T>(records: T[], getKey: (r: T) => number): Map<number, T[]> {
        const map = new Map<number, T[]>();
        for (const record of records) {
            const key = getKey(record);
            let list = map.get(key);
            if (!list) {
                list = [];
                map.set(key, list);
            }
            list.push(record);
        }
        return map;
    }
}
