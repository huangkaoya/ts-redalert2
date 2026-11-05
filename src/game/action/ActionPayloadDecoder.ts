import { ActivateSuperWeaponAction } from '@/game/action/ActivateSuperWeaponAction';
import { ActionType } from '@/game/action/ActionType';
import { DebugAction } from '@/game/action/DebugAction';
import { OrderUnitsAction } from '@/game/action/OrderUnitsAction';
import { PingLocationAction } from '@/game/action/PingLocationAction';
import { PlaceBuildingAction } from '@/game/action/PlaceBuildingAction';
import { SelectUnitsAction } from '@/game/action/SelectUnitsAction';
import { SellObjectAction } from '@/game/action/SellObjectAction';
import { ToggleAllianceAction } from '@/game/action/ToggleAllianceAction';
import { ToggleRepairAction } from '@/game/action/ToggleRepairAction';
import { UpdateQueueAction } from '@/game/action/UpdateQueueAction';

export class ActionPayloadDecoder {
    static decode(type: ActionType, data: Uint8Array): { type: ActionType; payload: unknown } {
        switch (type) {
            case ActionType.NoAction:
            case ActionType.DropPlayer:
            case ActionType.ObserveGame:
            case ActionType.ResignGame:
                return {
                    type,
                    payload: undefined,
                };
            case ActionType.DebugCommand:
                return {
                    type,
                    payload: DebugAction.decodePayload(data),
                };
            case ActionType.PlaceBuilding:
                return {
                    type,
                    payload: PlaceBuildingAction.decodePayload(data),
                };
            case ActionType.SellObject:
                return {
                    type,
                    payload: SellObjectAction.decodePayload(data),
                };
            case ActionType.ToggleRepair:
                return {
                    type,
                    payload: ToggleRepairAction.decodePayload(data),
                };
            case ActionType.SelectUnits:
                return {
                    type,
                    payload: SelectUnitsAction.decodePayload(data),
                };
            case ActionType.OrderUnits:
                return {
                    type,
                    payload: OrderUnitsAction.decodePayload(data),
                };
            case ActionType.UpdateQueue:
                return {
                    type,
                    payload: UpdateQueueAction.decodePayload(data),
                };
            case ActionType.ToggleAlliance:
                return {
                    type,
                    payload: ToggleAllianceAction.decodePayload(data),
                };
            case ActionType.ActivateSuperWeapon:
                return {
                    type,
                    payload: ActivateSuperWeaponAction.decodePayload(data),
                };
            case ActionType.PingLocation:
                return {
                    type,
                    payload: PingLocationAction.decodePayload(data),
                };
            default:
                throw new Error('Unsupported action type ' + type);
        }
    }
}
