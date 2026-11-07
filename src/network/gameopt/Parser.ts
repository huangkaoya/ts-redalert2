import { DataStream } from '@/data/DataStream';
import { MapNameLegacyEncoder } from './MapNameLegacyEncoder';
import { SlotType, SlotInfo, PingInfo } from './SlotInfo';
import { GameOpts, AiDifficulty, HumanPlayerInfo, AiPlayerInfo } from '@/game/gameopts/GameOpts';
import { FileNameEncoder } from './FileNameEncoder';
import { Base64 } from '@/util/Base64';
import { binaryStringToUtf16, uint8ArrayToBinaryString } from '@/util/string';
export class Parser {
    parseOptions(optionsString: string): GameOpts {
        const gameOpts: Partial<GameOpts> = {};
        const [gameOptsPart, playersPart, , aiPart] = optionsString.split(':');
        const parts = gameOptsPart.split(',');
        parts.shift();
        parts.shift();
        gameOpts.gameSpeed = 6 - Number(parts.shift());
        gameOpts.credits = Number(parts.shift());
        gameOpts.unitCount = Number(parts.shift());
        gameOpts.shortGame = Boolean(Number(parts.shift()));
        gameOpts.superWeapons = Boolean(Number(parts.shift()));
        gameOpts.buildOffAlly = Boolean(Number(parts.shift()));
        gameOpts.mcvRepacks = Boolean(Number(parts.shift()));
        gameOpts.cratesAppear = Boolean(Number(parts.shift()));
        gameOpts.gameMode = Number(parts.shift());
        gameOpts.hostTeams = Boolean(Number(parts.shift()));
        const mapTitlePart = parts.shift()!;
        gameOpts.mapTitle = Base64.isBase64(mapTitlePart)
            ? binaryStringToUtf16(Base64.decode(mapTitlePart))
            : new MapNameLegacyEncoder().decode(mapTitlePart);
        gameOpts.maxSlots = Number(parts.shift());
        gameOpts.mapOfficial = Boolean(Number(parts.shift()));
        gameOpts.mapSizeBytes = Number(parts.shift());
        gameOpts.mapName = new FileNameEncoder().decode(parts.shift()!);
        gameOpts.mapDigest = parts.shift();
        gameOpts.destroyableBridges = Boolean(Number(parts.shift() ?? '1'));
        gameOpts.multiEngineer = Boolean(Number(parts.shift() ?? '0'));
        gameOpts.noDogEngiKills = Boolean(Number(parts.shift() ?? '0'));
        gameOpts.instantCapture = Boolean(Number(parts.shift() ?? '1'));
        gameOpts.delayedOils = Boolean(Number(parts.shift() ?? '0'));
        gameOpts.balanceChanges = Boolean(Number(parts.shift() ?? '0'));
        gameOpts.unknown = parts.length ? parts.join(',') : undefined;
        gameOpts.humanPlayers = this.parsePlayerOpts(playersPart);
        gameOpts.aiPlayers = this.parseAiOpts(aiPart?.slice(0, -1));
        return gameOpts as GameOpts;
    }
    parsePlayerOpts(playersString: string): HumanPlayerInfo[] {
        const parts = playersString.split(',');
        if (parts.length % 8 !== 0) {
            throw new Error(`Couldn't parse gameopt: unexpected players data length ${parts.length}`);
        }
        const players: HumanPlayerInfo[] = [];
        const playerCount = Math.floor(parts.length / 8);
        for (let i = 0; i < playerCount; i++) {
            const player: HumanPlayerInfo = {
                name: parts[i * 8],
                countryId: Number(parts[i * 8 + 1]),
                colorId: Number(parts[i * 8 + 2]),
                startPos: Number(parts[i * 8 + 3]),
                teamId: Number(parts[i * 8 + 4])
            };
            players.push(player);
        }
        return players;
    }
    parseAiOpts(aiString?: string): (AiPlayerInfo | undefined)[] {
        const aiPlayers: (AiPlayerInfo | undefined)[] = [];
        if (!aiString) {
            return aiPlayers;
        }
        const parts = aiString.split(',');
        if (parts.length % 5 !== 0) {
            throw new Error(`Couldn't parse gameopt: unexpected ai data length ${parts.length}`);
        }
        const aiCount = Math.floor(parts.length / 5);
        for (let i = 0; i < aiCount; i++) {
            const aiPlayer: AiPlayerInfo = {
                difficulty: Number(parts[i * 5]),
                countryId: Number(parts[i * 5 + 1]),
                colorId: Number(parts[i * 5 + 2]),
                startPos: Number(parts[i * 5 + 3]),
                teamId: Number(parts[i * 5 + 4])
            };
            aiPlayers.push(aiPlayer.countryId !== -1 ? aiPlayer : undefined);
        }
        return aiPlayers;
    }
    parseTopic(topicString: string): any {
        const parts = topicString.split(',');
        if (parts.length < 6) {
            return undefined;
        }
        const gameId = parts[0];
        const modHash = Number(parts[1]);
        const maxPlayers = gameId.charAt(2);
        const aiPlayers = parts[2];
        const observers = parts[3];
        const observable = parts[4];
        const mapName = new FileNameEncoder().decode(parts[5]);
        return {
            description: parts[6] ? binaryStringToUtf16(Base64.decode(parts[6])) : '',
            modHash: modHash,
            modName: parts[7] ? binaryStringToUtf16(Base64.decode(parts[7])) : undefined,
            aiPlayers: Number(aiPlayers),
            maxPlayers: Number(maxPlayers),
            observers: Number(observers),
            observable: Boolean(Number(observable)),
            mapName: mapName
        };
    }
    parsePingData(pingString: string): PingInfo[] {
        const parts = pingString.split(',').slice(1);
        if (parts.length % 2 !== 0) {
            throw new Error(`Couldn't parse gameopt: unexpected ping data length ${parts.length}`);
        }
        const pings: PingInfo[] = [];
        const pairCount = Math.floor(parts.length / 2);
        for (let i = 0; i < pairCount; i++) {
            pings.push({
                playerName: parts[i * 2],
                ping: Number(parts[i * 2 + 1])
            });
        }
        return pings;
    }
    parseSlotData(slotString: string): SlotInfo[] {
        const slots: SlotInfo[] = [];
        const slotParts = slotString.slice(1, -1).split(',');
        for (const slotPart of slotParts) {
            const slot: SlotInfo = { type: SlotType.Closed };
            if (slotPart === '@Closed@') {
                slot.type = SlotType.Closed;
            }
            else if (slotPart === '@Open@') {
                slot.type = SlotType.Open;
            }
            else if (slotPart === '@OpenObserver@') {
                slot.type = SlotType.OpenObserver;
            }
            else if (slotPart === '@EasyAI@') {
                slot.type = SlotType.Ai;
                slot.difficulty = AiDifficulty.Easy;
            }
            else {
                slot.type = SlotType.Player;
                slot.name = slotPart;
            }
            slots.push(slot);
        }
        return slots;
    }
    parsePlayerActions(data: Uint8Array): Array<{
        id: number;
        params: Uint8Array;
    }> {
        const stream = new DataStream(data);
        const actionCount = stream.readUint8();
        const actions: Array<{
            id: number;
            params: Uint8Array;
        }> = [];
        for (let i = 0; i < actionCount; i++) {
            const id = stream.readUint8();
            const paramLength = stream.readUint16();
            const params = paramLength > 0 ? stream.readUint8Array(paramLength) : new Uint8Array();
            actions.push({ id, params });
        }
        return actions;
    }
    parseAllPlayerActions(stream: DataStream): Map<number, Array<{
        id: number;
        params: Uint8Array;
    }>> {
        const playerCount = stream.readUint8();
        const allActions = new Map<number, Array<{
            id: number;
            params: Uint8Array;
        }>>();
        for (let i = 0; i < playerCount; i++) {
            const playerId = stream.readUint8();
            const dataLength = stream.readUint16();
            const data = dataLength > 0 ? stream.readUint8Array(dataLength) : new Uint8Array();
            const actions = this.parsePlayerActions(data);
            allActions.set(playerId, actions);
        }
        return allActions;
    }
    parseMapData(data: Uint8Array): string {
        return uint8ArrayToBinaryString(data);
    }
}
