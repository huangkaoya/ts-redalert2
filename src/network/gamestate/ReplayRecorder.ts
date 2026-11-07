import { Replay, ReplayEventType } from './Replay';

export class ReplayRecorder {
    private readonly checkpointInterval = 300; // ~20 seconds at 15 ticks/sec

    constructor(
        private readonly game: any,
        private readonly replay: Replay,
    ) {}

    recordActions(tick: number, actions: any[]): void {
        for (const action of actions) {
            // NoAction is only a lockstep placeholder. Other actions can have
            // an empty payload and still change simulation state (for example
            // resign, drop, or switch to observer).
            if (action?.actionType === 0) {
                continue;
            }
            let serialized: Uint8Array | undefined;
            try {
                serialized = action.serialize?.();
            }
            catch (error) {
                console.warn('[ReplayRecorder] Failed to serialize action for replay recording', {
                    tick,
                    actionType: action?.actionType,
                    action,
                    error,
                });
                continue;
            }
            if (!serialized) {
                continue;
            }
            let playerId = 0;
            if (action.player && typeof this.game.getPlayerNumber === 'function') {
                playerId = this.game.getPlayerNumber(action.player);
            } else if (Number.isInteger(action.player?.index)) {
                // Compatibility fallback for recorder test doubles and legacy
                // integrations. Runtime Player objects use getPlayerNumber.
                playerId = action.player.index;
            }
            this.replay.actionRecords.push({
                tick,
                playerId,
                actionType: action.actionType,
                data: serialized,
            });
        }
    }

    /** Capture a checkpoint after the simulation has advanced past this tick. */
    recordTick(tick: number): void {
        if (tick > 0 && tick % this.checkpointInterval === 0 &&
            (this.replay.hashCheckpoints.length === 0 ||
             this.replay.hashCheckpoints[this.replay.hashCheckpoints.length - 1].tick !== tick)) {
            this.replay.hashCheckpoints.push({
                tick,
                hash: this.game.getHash(),
            });
        }
    }

    recordChatMessage(tick: number, playerName: string, message: string): void {
        const playerId = this.resolvePlayerId(playerName);
        this.replay.eventRecords.push({
            tick,
            type: ReplayEventType.Chat,
            playerId,
            payload: message,
        });
    }

    recordTaunt(tick: number, playerName: string, tauntNo: number): void {
        const playerId = this.resolvePlayerId(playerName);
        this.replay.eventRecords.push({
            tick,
            type: ReplayEventType.Taunt,
            playerId,
            payload: String(tauntNo),
        });
    }

    private resolvePlayerId(playerName: string): number {
        try {
            const player = this.game.getPlayerByName(playerName);
            if (player && typeof this.game.getPlayerNumber === 'function') {
                return this.game.getPlayerNumber(player);
            }
        } catch {
            // Fall through to the option list for older game test doubles.
        }
        const humanPlayerId = this.replay.gameOpts?.humanPlayers?.findIndex((player: any) => player.name === playerName);
        return humanPlayerId !== undefined && humanPlayerId >= 0 ? humanPlayerId : 0;
    }
}
