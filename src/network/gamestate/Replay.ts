import { DataStream } from '@/data/DataStream';
import { GameOpts } from '@/game/gameopts/GameOpts';
import { Parser } from '@/network/gameopt/Parser';
import { Serializer } from '@/network/gameopt/Serializer';
import { Base64 } from '@/util/Base64';
import {
    base64StringToUint8Array,
    binaryStringToUtf16,
    uint8ArrayToBase64String,
    utf16ToBinaryString,
} from '@/util/string';

/** Legacy project-specific replay magic (kept for old local recordings). */
const REPLAY_MAGIC = 0x52324152;
const LEGACY_REPLAY_FORMAT_VERSION = 1;
const CHRONO_DIVIDE_REPLAY_VERSIONS = new Set([5, 6]);
const CHRONO_DIVIDE_REPLAY_TAG = 'RA2TSREPL_v';

export interface ActionRecord {
    tick: number;
    playerId: number;
    actionType: number;
    data: Uint8Array;
}

export const enum ReplayEventType {
    Chat = 1,
    Taunt = 2,
}

export interface ReplayEventRecord {
    tick: number;
    type: ReplayEventType;
    playerId: number;
    payload: string;
}

export interface HashCheckpoint {
    tick: number;
    hash: number;
}

export interface ReplayHeader {
    gameId: string;
    gameTimestamp: number;
    engineVersion: string;
    modHash: string;
    gameOptsSerialized: string;
    replayVersion?: number;
}

interface ParsedChronoDivideHeader extends ReplayHeader {
    replayVersion: number;
    lines: string[];
}

export class Replay {
    /** Native Chrono Divide replay extension used for import and export. */
    public static readonly extension = '.rpl';
    /** Extension used by the previous local-only binary replay format. */
    public static readonly legacyExtension = '.ra2replay';
    public static readonly supportedExtensions = [Replay.extension, Replay.legacyExtension];

    public name?: string;
    public timestamp: number = 0;
    public gameId: string = '';
    public gameTimestamp: number = 0;
    public gameOpts: GameOpts | any;
    public engineVersion: string = '';
    public modHash: string = '';
    public finishedTick?: number;

    public actionRecords: ActionRecord[] = [];
    public eventRecords: ReplayEventRecord[] = [];
    public hashCheckpoints: HashCheckpoint[] = [];

    get endTick(): number {
        return this.finishedTick ?? 0;
    }

    public static sanitizeFileName(filename: string): string {
        return filename
            .replace(/[/?<>\\:*|"]/g, '_')
            .replace(/[\x00-\x1f\x7f-\x9f]/g, '_')
            .slice(0, 128);
    }

    finish(currentTick: number): void {
        this.finishedTick = currentTick;
    }

    /**
     * Serialize as the v6 text replay format used by Chrono Divide v0.85.0.
     * Action records are regrouped into the per-player turn payload used by the
     * live game's lockstep protocol.
     */
    serialize(): string {
        if (this.finishedTick === undefined) {
            throw new Error('Replay is not finished');
        }
        if (!this.gameOpts) {
            throw new Error('Game options must be set first');
        }
        if (!this.engineVersion) {
            throw new Error('Engine version is not set');
        }
        if (this.modHash === '') {
            throw new Error('Mod hash is not set');
        }

        const engineVersion = normalizeEngineVersion(this.engineVersion);
        const gameOptsSerialized = new Serializer().serializeOptions(this.gameOpts);
        const lines = [
            `${CHRONO_DIVIDE_REPLAY_TAG}6`,
            `ENGINE ${engineVersion} ${this.modHash}`,
            `${this.gameId} ${this.gameTimestamp} ${gameOptsSerialized}`,
        ];

        const actionEvents = this.buildTurnActionEvents();
        const events: Array<{ tick: number; priority: number; sequence: number; line: string }> = [];
        for (const [tick, actions] of actionEvents) {
            const stream = new DataStream();
            new Serializer().serializeAllPlayerActions(stream, actions);
            events.push({
                tick,
                priority: 0,
                sequence: 0,
                line: `${tick}=0|${uint8ArrayToBase64String(stream.toUint8Array())}`,
            });
        }
        this.eventRecords.forEach((event, sequence) => {
            let payload: string;
            if (event.type === ReplayEventType.Chat) {
                payload = `${event.playerId}:${Base64.encode(utf16ToBinaryString(event.payload))}`;
            }
            else if (event.type === ReplayEventType.Taunt) {
                payload = `${event.playerId}:${event.payload}`;
            }
            else {
                throw new Error(`Unsupported replay event type "${event.type}"`);
            }
            events.push({
                tick: event.tick,
                priority: 1,
                sequence,
                line: `${event.tick}=${event.type}|${payload}`,
            });
        });
        events.sort((a, b) => a.tick - b.tick || a.priority - b.priority || a.sequence - b.sequence);
        lines.push(...events.map((event) => event.line));
        lines.push(`END ${this.finishedTick}`);
        return `${lines.join('\n')}\n`;
    }

    unserialize(data: string, meta?: { name?: string; timestamp?: number }): void {
        const serialized = data.replace(/^\uFEFF/, '');
        if (serialized.startsWith(CHRONO_DIVIDE_REPLAY_TAG)) {
            this.unserializeChronoDivideReplay(serialized, meta);
        }
        else {
            this.unserializeLegacyBinaryReplay(serialized, meta);
        }
    }

    async parseHeader(data: string | Blob): Promise<ReplayHeader> {
        const serialized = (typeof data === 'string' ? data : await data.text()).replace(/^\uFEFF/, '');
        if (serialized.startsWith(CHRONO_DIVIDE_REPLAY_TAG)) {
            const { replayVersion, engineVersion, modHash, gameId, gameTimestamp, gameOptsSerialized } = parseChronoDivideHeader(serialized);
            return { replayVersion, engineVersion, modHash, gameId, gameTimestamp, gameOptsSerialized };
        }

        const bytes = base64ToUint8Array(serialized);
        const ds = new DataStream(bytes);
        const magic = ds.readUint32();
        if (magic !== REPLAY_MAGIC) {
            throw new Error('Invalid replay file: bad magic');
        }
        const version = ds.readUint16();
        if (version !== LEGACY_REPLAY_FORMAT_VERSION) {
            throw new Error(`Unsupported legacy replay version: ${version}`);
        }
        const engineVersion = ds.readUtf8WithLen();
        const modHash = ds.readUtf8WithLen();
        const gameId = ds.readUtf8WithLen();
        const gameTimestamp = ds.readUint32();
        ds.readUint32(); // finished tick
        ds.readFloat64(); // save timestamp
        const gameOptsSerialized = ds.readUtf8WithLen();
        return { gameId, gameTimestamp, engineVersion, modHash, gameOptsSerialized };
    }

    private unserializeChronoDivideReplay(data: string, meta?: { name?: string; timestamp?: number }): void {
        const header = parseChronoDivideHeader(data);
        const parser = new Parser();
        this.engineVersion = header.engineVersion;
        this.modHash = header.modHash;
        this.gameId = header.gameId;
        this.gameTimestamp = header.gameTimestamp;
        this.gameOpts = parser.parseOptions(header.gameOptsSerialized);
        this.name = meta?.name ?? this.gameOpts.mapTitle;
        this.timestamp = meta?.timestamp ?? 0;
        this.finishedTick = undefined;
        this.actionRecords = [];
        this.eventRecords = [];
        this.hashCheckpoints = [];

        let foundEnd = false;
        for (let i = 3; i < header.lines.length; i++) {
            const line = header.lines[i];
            if (!line) {
                continue;
            }
            if (line.startsWith('END ')) {
                const endMatch = line.match(/^END (\d+)$/);
                if (!endMatch) {
                    throw new Error(`Invalid replay end tag "${line}"`);
                }
                this.finishedTick = Number(endMatch[1]);
                foundEnd = true;
                break;
            }

            const eventMatch = line.match(/^(\d+)=(\d+)\|(.+)$/);
            if (!eventMatch) {
                throw new Error(`Invalid event line "${line}"`);
            }
            const tick = Number(eventMatch[1]);
            const type = Number(eventMatch[2]);
            const payload = eventMatch[3];
            if (type === 0) {
                const actionStream = new DataStream(base64StringToUint8Array(payload));
                const actionsByPlayer = parser.parseAllPlayerActions(actionStream);
                for (const [playerId, actions] of actionsByPlayer) {
                    for (const action of actions) {
                        this.actionRecords.push({
                            tick,
                            playerId,
                            actionType: action.id,
                            data: action.params,
                        });
                    }
                }
            }
            else if (type === ReplayEventType.Chat || type === ReplayEventType.Taunt) {
                const payloadSeparator = payload.indexOf(':');
                if (payloadSeparator < 1) {
                    throw new Error(`Invalid replay event payload "${payload}"`);
                }
                const playerId = Number(payload.slice(0, payloadSeparator));
                const eventPayload = payload.slice(payloadSeparator + 1);
                this.eventRecords.push({
                    tick,
                    type,
                    playerId,
                    payload: type === ReplayEventType.Chat
                        ? binaryStringToUtf16(Base64.decode(eventPayload))
                        : eventPayload,
                });
            }
            else {
                throw new Error(`Unsupported replay event type "${type}" at game tick "${tick}"`);
            }
        }
        if (!foundEnd) {
            throw new Error('Incomplete replay data');
        }
    }

    private unserializeLegacyBinaryReplay(data: string, meta?: { name?: string; timestamp?: number }): void {
        const bytes = base64ToUint8Array(data);
        const ds = new DataStream(bytes);
        const magic = ds.readUint32();
        if (magic !== REPLAY_MAGIC) {
            throw new Error('Invalid replay file: bad magic');
        }
        const version = ds.readUint16();
        if (version !== LEGACY_REPLAY_FORMAT_VERSION) {
            throw new Error(`Unsupported legacy replay version: ${version}`);
        }

        this.engineVersion = ds.readUtf8WithLen();
        this.modHash = ds.readUtf8WithLen();
        this.gameId = ds.readUtf8WithLen();
        this.gameTimestamp = ds.readUint32();
        this.finishedTick = ds.readUint32();
        this.timestamp = ds.readFloat64();
        this.gameOpts = migrateLegacyGameOpts(JSON.parse(ds.readUtf8WithLen()));
        const embeddedName = ds.readUtf8WithLen();
        this.name = meta?.name ?? embeddedName;
        if (meta?.timestamp !== undefined) {
            this.timestamp = meta.timestamp;
        }

        const actionCount = ds.readUint32();
        this.actionRecords = [];
        for (let i = 0; i < actionCount; i++) {
            const tick = ds.readUint32();
            const playerId = ds.readUint8();
            const actionType = ds.readUint8();
            const dataLength = ds.readUint16();
            this.actionRecords.push({ tick, playerId, actionType, data: ds.readUint8Array(dataLength) });
        }
        const eventCount = ds.readUint32();
        this.eventRecords = [];
        for (let i = 0; i < eventCount; i++) {
            const tick = ds.readUint32();
            const type = ds.readUint8() as ReplayEventType;
            const playerId = ds.readUint8();
            const payload = ds.readUtf8WithLen();
            this.eventRecords.push({ tick, type, playerId, payload });
        }
        const checkpointCount = ds.readUint32();
        this.hashCheckpoints = [];
        for (let i = 0; i < checkpointCount; i++) {
            this.hashCheckpoints.push({ tick: ds.readUint32(), hash: ds.readUint32() });
        }
    }

    private buildTurnActionEvents(): Map<number, Map<number, Array<{ id: number; params: Uint8Array }>>> {
        const events = new Map<number, Map<number, Array<{ id: number; params: Uint8Array }>>>();
        for (const record of this.actionRecords) {
            // NoAction is an empty synchronization placeholder and is omitted
            // from native replay turn events, just as in the v0.85 recorder.
            if (record.actionType === 0) {
                continue;
            }
            let players = events.get(record.tick);
            if (!players) {
                players = new Map();
                events.set(record.tick, players);
            }
            let actions = players.get(record.playerId);
            if (!actions) {
                actions = [];
                players.set(record.playerId, actions);
            }
            actions.push({ id: record.actionType, params: record.data });
        }
        // Preserve each player's first-seen order. Native v0.85 replays keep
        // the Map insertion order, and simultaneous actions can be order-sensitive.
        return new Map([...events.entries()].sort(([a], [b]) => a - b));
    }
}

function parseChronoDivideHeader(data: string): ParsedChronoDivideHeader {
    const lines = data.split(/\r?\n/);
    const versionMatch = lines[0]?.match(/^RA2TSREPL_v(\d+)$/);
    if (!versionMatch) {
        throw new Error('Unknown replay format');
    }
    const replayVersion = Number(versionMatch[1]);
    if (!CHRONO_DIVIDE_REPLAY_VERSIONS.has(replayVersion)) {
        throw new Error(`Unsupported replay version ${replayVersion}`);
    }

    const engineMatch = lines[1]?.match(/^ENGINE (\d+\.\d+)(?: (\d+))?$/);
    if (!engineMatch) {
        throw new Error('Missing or invalid game engine version line');
    }
    const gameMatch = lines[2]?.match(/^([a-zA-Z0-9-]+) (\d+) (.*)$/);
    if (!gameMatch) {
        throw new Error('Missing or invalid game id/time/opts line');
    }

    const gameOptsSerialized = replayVersion < 6
        ? Base64.decode(gameMatch[3])
        : gameMatch[3];
    return {
        replayVersion,
        engineVersion: engineMatch[1],
        modHash: engineMatch[2] ?? '0',
        gameId: gameMatch[1],
        gameTimestamp: Number(gameMatch[2]),
        gameOptsSerialized,
        lines,
    };
}

function normalizeEngineVersion(version: string): string {
    const parts = version.split('.');
    return parts.length > 2 ? parts.slice(0, 2).join('.') : version;
}

function migrateLegacyGameOpts(gameOpts: GameOpts | any): GameOpts | any {
    // Before the v0.85 fields were modeled locally, the network parser retained
    // their values as a trailing comma-separated "unknown" string.
    if ((gameOpts.instantCapture === undefined || gameOpts.delayedOils === undefined || gameOpts.balanceChanges === undefined) &&
        typeof gameOpts.unknown === 'string') {
        const values = gameOpts.unknown.split(',');
        // Keep this list as wire-format keys instead of keyof GameOpts: older
        // clients do not declare every option that may be present in a replay.
        const legacyOptionFields: string[] = ['instantCapture', 'delayedOils', 'balanceChanges'];
        let consumedOptions = 0;
        for (let i = 0; i < legacyOptionFields.length && i < values.length; i++) {
            if (values[i] !== '0' && values[i] !== '1') {
                break;
            }
            gameOpts[legacyOptionFields[i]] ??= values[i] === '1';
            consumedOptions++;
        }
        if (consumedOptions > 0) {
            gameOpts.unknown = values.slice(consumedOptions).join(',') || undefined;
        }
    }
    return gameOpts;
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
