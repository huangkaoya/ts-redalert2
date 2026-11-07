import { DataStream } from '@/data/DataStream';
import { SlotType, SlotInfo, PingInfo } from './SlotInfo';
import { GameOpts, AiDifficulty, HumanPlayerInfo, AiPlayerInfo } from '@/game/gameopts/GameOpts';
import { MapNameLegacyEncoder } from './MapNameLegacyEncoder';
import { FileNameEncoder } from './FileNameEncoder';
import { Base64 } from '@/util/Base64';
import { utf16ToBinaryString, binaryStringToUint8Array } from '@/util/string';
export class Serializer {
    static readonly MAX_ACTION_PAYLOAD_SIZE = 65536;
    serializeOptions(gameOpts: GameOpts, useLegacyMapName = false): string {
        const gameMode = gameOpts.gameMode;
        const mapTitle = useLegacyMapName
            ? new MapNameLegacyEncoder().encode(gameOpts.mapTitle)
            : Base64.encode(utf16ToBinaryString(gameOpts.mapTitle));
        const mapName = new FileNameEncoder().encode(gameOpts.mapName);
        const optionsParts = [
            '0',
            '0',
            6 - gameOpts.gameSpeed,
            gameOpts.credits,
            gameOpts.unitCount,
            Number(gameOpts.shortGame),
            Number(gameOpts.superWeapons),
            Number(gameOpts.buildOffAlly),
            Number(gameOpts.mcvRepacks),
            Number(gameOpts.cratesAppear),
            gameMode,
            Number(gameOpts.hostTeams ?? false),
            mapTitle,
            gameOpts.maxSlots,
            Number(gameOpts.mapOfficial),
            gameOpts.mapSizeBytes,
            mapName,
            gameOpts.mapDigest,
            Number(gameOpts.destroyableBridges),
            Number(gameOpts.multiEngineer),
            Number(gameOpts.noDogEngiKills),
            Number(gameOpts.instantCapture ?? true),
            Number(gameOpts.delayedOils ?? false),
            Number(gameOpts.balanceChanges ?? false),
            ...(gameOpts.unknown ? [gameOpts.unknown] : [])
        ].join(',');
        const playersPart = gameOpts.humanPlayers
            .map(player => `${player.name},${player.countryId},${player.colorId},${player.startPos},${player.teamId},0,0,0`)
            .join(',');
        const aiPart = this.serializeAiOpts(gameOpts.aiPlayers);
        return `${optionsParts}:${playersPart}:@:${aiPart},`;
    }
    serializeAiOpts(aiPlayers: (AiPlayerInfo | undefined)[]): string {
        return aiPlayers
            .map(ai => ai
            ? `${ai.difficulty},${ai.countryId},${ai.colorId},${ai.startPos},${ai.teamId}`
            : '0,-1,-1,-1,-1')
            .join(',');
    }
    serializePingData(pings: PingInfo[]): string {
        return pings.length + ',' + pings.map(ping => `${ping.playerName},${ping.ping}`).join(',');
    }
    serializeSlotData(slots: SlotInfo[]): string {
        const slotStrings = slots.map(slot => {
            if (slot.type === SlotType.Closed) {
                return '@Closed@';
            }
            if (slot.type === SlotType.Open) {
                return '@Open@';
            }
            if (slot.type === SlotType.OpenObserver) {
                return '@OpenObserver@';
            }
            if (slot.type === SlotType.Ai) {
                return '@EasyAI@';
            }
            else if (slot.type === SlotType.Player) {
                return slot.name;
            }
            throw new Error(`Unexpected slot info with type ${SlotType[slot.type]}`);
        });
        return slotStrings.join(',') + ',';
    }
    serializeLoadInfo(loadInfo: Array<{
        name: string;
        status: number;
        loadPercent: number;
        ping: number;
        lagAllowanceMillis: number;
    }>): string {
        return loadInfo
            .map(info => [
            info.name,
            info.status,
            info.loadPercent,
            info.ping,
            info.lagAllowanceMillis
        ].join(','))
            .join(',');
    }
    serializePlayerActions(actions: Array<{
        id: number;
        params: Uint8Array;
    }>): Uint8Array {
        const stream = new DataStream();
        stream.writeUint8(actions.length);
        for (const { id, params } of actions) {
            stream.writeUint8(id);
            stream.writeUint16(params.byteLength);
            if (params.byteLength > 0) {
                if (params.byteLength > Serializer.MAX_ACTION_PAYLOAD_SIZE - stream.position) {
                    console.error(`Action #${id} payload exceeds max data size`, params);
                    throw new RangeError('Maximum payload data size exceeded');
                }
                stream.writeUint8Array(params);
            }
        }
        return stream.toUint8Array();
    }
    serializeAllPlayerActions(stream: DataStream, allActions: Map<number, Array<{
        id: number;
        params: Uint8Array;
    }>>): void {
        stream.writeUint8(allActions.size);
        for (const [playerId, actions] of allActions) {
            stream.writeUint8(playerId);
            const serializedActions = this.serializePlayerActions(actions);
            stream.writeUint16(serializedActions.byteLength);
            if (serializedActions.byteLength > 0) {
                if (serializedActions.byteLength > Serializer.MAX_ACTION_PAYLOAD_SIZE) {
                    console.error(`Player #${playerId} actions payload exceeds max data size`, actions);
                    throw new RangeError('Maximum payload data size exceeded');
                }
                stream.writeUint8Array(serializedActions);
            }
        }
    }
    serializeMapData(mapData: string): Uint8Array {
        return binaryStringToUint8Array(mapData);
    }
}
