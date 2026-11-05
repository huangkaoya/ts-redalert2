import { describe, expect, test } from 'bun:test';
import { ActionPayloadDecoder } from '@/game/action/ActionPayloadDecoder';
import { ActionType } from '@/game/action/ActionType';
import { SellObjectAction } from '@/game/action/SellObjectAction';
import { ToggleRepairAction } from '@/game/action/ToggleRepairAction';
import { SelectUnitsAction } from '@/game/action/SelectUnitsAction';
import { PlaceBuildingAction } from '@/game/action/PlaceBuildingAction';
import { OrderUnitsAction } from '@/game/action/OrderUnitsAction';
import { PingLocationAction } from '@/game/action/PingLocationAction';
import { ActivateSuperWeaponAction } from '@/game/action/ActivateSuperWeaponAction';
import { ToggleAllianceAction } from '@/game/action/ToggleAllianceAction';
import { UpdateQueueAction, UpdateType } from '@/game/action/UpdateQueueAction';
import { DebugAction, DebugCommandType } from '@/game/action/DebugAction';

describe('ActionPayloadDecoder (模拟层 parity)', () => {
    test('empty-payload actions return undefined payload', () => {
        for (const type of [
            ActionType.NoAction,
            ActionType.DropPlayer,
            ActionType.ObserveGame,
            ActionType.ResignGame,
        ]) {
            expect(ActionPayloadDecoder.decode(type, new Uint8Array())).toEqual({
                type,
                payload: undefined,
            });
        }
    });

    test('sell / repair / select / place / ping / alliance / queue / debug / superweapon / order round-trip', () => {
        expect(ActionPayloadDecoder.decode(
            ActionType.SellObject,
            SellObjectAction.encodePayload({ objectId: 42 }),
        ).payload).toEqual({ objectId: 42 });

        expect(ActionPayloadDecoder.decode(
            ActionType.ToggleRepair,
            ToggleRepairAction.encodePayload({ buildingId: 7 }),
        ).payload).toEqual({ buildingId: 7 });

        expect(ActionPayloadDecoder.decode(
            ActionType.SelectUnits,
            SelectUnitsAction.encodePayload({ unitIds: [1, 2, 3] }),
        ).payload).toEqual({ unitIds: [1, 2, 3] });

        expect(ActionPayloadDecoder.decode(
            ActionType.PlaceBuilding,
            PlaceBuildingAction.encodePayload({
                buildingId: 9,
                tile: { rx: 10, ry: 11 },
            }),
        ).payload).toEqual({
            buildingId: 9,
            tile: { rx: 10, ry: 11 },
        });

        expect(ActionPayloadDecoder.decode(
            ActionType.PingLocation,
            PingLocationAction.encodePayload({ tile: { rx: 3, ry: 4 } }),
        ).payload).toEqual({ tile: { rx: 3, ry: 4 } });

        expect(ActionPayloadDecoder.decode(
            ActionType.ToggleAlliance,
            ToggleAllianceAction.encodePayload({ playerId: 2, toggle: true }),
        ).payload).toEqual({ playerId: 2, toggle: true });

        expect(ActionPayloadDecoder.decode(
            ActionType.UpdateQueue,
            UpdateQueueAction.encodePayload({
                queueType: 1,
                updateType: UpdateType.Add,
                item: { id: 5, type: 2, quantity: 3 },
            }),
        ).payload).toEqual({
            queueType: 1,
            updateType: UpdateType.Add,
            item: { id: 5, type: 2, quantity: 3 },
        });

        expect(ActionPayloadDecoder.decode(
            ActionType.DebugCommand,
            DebugAction.encodePayload({
                commandType: DebugCommandType.SetGlobalDebugText,
                params: { text: 'hello' },
            }),
        ).payload).toEqual({
            commandType: DebugCommandType.SetGlobalDebugText,
            params: { text: 'hello' },
        });

        expect(ActionPayloadDecoder.decode(
            ActionType.ActivateSuperWeapon,
            ActivateSuperWeaponAction.encodePayload({
                superWeaponType: 1,
                tile: { rx: 8, ry: 9 },
                tile2: { rx: 10, ry: 11 },
            }),
        ).payload).toEqual({
            superWeaponType: 1,
            tile: { rx: 8, ry: 9 },
            tile2: { rx: 10, ry: 11 },
        });

        expect(ActionPayloadDecoder.decode(
            ActionType.OrderUnits,
            OrderUnitsAction.encodePayload({
                orderType: 4,
                queue: true,
                target: { tile: { rx: 1, ry: 2 }, objectId: 99 },
            }),
        ).payload).toEqual({
            orderType: 4,
            queue: true,
            target: { tile: { rx: 1, ry: 2 }, objectId: 99 },
        });
    });

    test('unsupported action type throws without fallback', () => {
        expect(() => ActionPayloadDecoder.decode(999 as ActionType, new Uint8Array())).toThrow(
            /Unsupported action type/,
        );
    });
});
