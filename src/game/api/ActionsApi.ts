import { ActionType } from '@/game/action/ActionType';
import { UpdateType } from '@/game/action/UpdateQueueAction';
import { DebugCommand, DebugCommandType } from '@/game/action/DebugAction';
interface Tile {
    x: number;
    y: number;
}
interface Target {
}
interface BuildingRules {
}
interface ObjectRules {
}
interface Player {
    name: string;
}
interface ActionFactory {
    create(actionType: ActionType): any;
}
interface ActionQueue {
    push(action: any): void;
}
interface Game {
    rules: {
        getBuilding(type: any): BuildingRules;
        getObject(type: any, subType: any): ObjectRules;
    };
    getPlayerByName(name: string): Player;
    map: {
        tiles: {
            getByMapCoords(x: number, y: number): any;
        };
        tileOccupation: {
            getBridgeOnTile(tile: any): any;
        };
    };
    getWorld(): {
        hasObjectId(id: number): boolean;
    };
    getObjectById(id: number): any;
    createTarget(object: any, tile: any): Target;
}
interface LocalPlayer {
    name: string;
    getDebugMode(): boolean;
}
interface ChatApi {
    sayAll(playerName: string, message: string): void;
}
export class ActionsApi {
    private actionFactory: ActionFactory;
    private actionQueue: ActionQueue;
    private game: Game;
    private localPlayer: LocalPlayer;
    private chatApi?: ChatApi;
    constructor(game: Game, actionFactory: ActionFactory, actionQueue: ActionQueue, localPlayer: LocalPlayer, chatApi?: ChatApi) {
        this.game = game;
        this.actionFactory = actionFactory;
        this.actionQueue = actionQueue;
        this.localPlayer = localPlayer;
        this.chatApi = chatApi;
    }
    placeBuilding(buildingType: any, x: number, y: number): void {
        this.createAndPushAction(ActionType.PlaceBuilding, (action) => {
            action.buildingRules = this.game.rules.getBuilding(buildingType);
            action.tile = { x, y };
        });
    }
    sellObject(objectId: number): void {
        this.createAndPushAction(ActionType.SellObject, (action) => {
            action.objectId = objectId;
        });
    }
    sellBuilding(buildingId: number): void {
        this.sellObject(buildingId);
    }
    toggleRepairWrench(buildingId: any): void {
        this.createAndPushAction(ActionType.ToggleRepair, (action) => {
            action.buildingId = buildingId;
        });
    }
    toggleAlliance(playerName: string, toggle: boolean): void {
        this.createAndPushAction(ActionType.ToggleAlliance, (action) => {
            action.toPlayer = this.game.getPlayerByName(playerName);
            action.toggle = toggle;
        });
    }
    pauseProduction(queueType: any): void {
        this.createAndPushAction(ActionType.UpdateQueue, (action) => {
            action.queueType = queueType;
            action.updateType = UpdateType.Pause;
        });
    }
    resumeProduction(queueType: any): void {
        this.createAndPushAction(ActionType.UpdateQueue, (action) => {
            action.queueType = queueType;
            action.updateType = UpdateType.Resume;
        });
    }

    // 完善模拟层逻辑：queueForProduction(queueType, name, type, quantity) → getObject(name, type)
    queueForProduction(queueType: any, name: any, type: any, quantity: number): void {
        const item = this.game.rules.getObject(name, type);
        this.createAndPushAction(ActionType.UpdateQueue, (action) => {
            action.queueType = queueType;
            action.updateType = UpdateType.Add;
            action.item = item;
            action.quantity = quantity;
        });
    }
    unqueueFromProduction(queueType: any, name: any, type: any, quantity: number): void {
        const item = this.game.rules.getObject(name, type);
        this.createAndPushAction(ActionType.UpdateQueue, (action) => {
            action.queueType = queueType;
            action.updateType = UpdateType.Cancel;
            action.item = item;
            action.quantity = quantity;
        });
    }
    activateSuperWeapon(superWeaponType: any, targetTile: {
        rx: number;
        ry: number;
    }, secondaryTile?: {
        rx: number;
        ry: number;
    }): void {
        this.createAndPushAction(ActionType.ActivateSuperWeapon, (action) => {
            action.superWeaponType = superWeaponType;
            action.tile = { x: targetTile.rx, y: targetTile.ry };
            action.tile2 = secondaryTile ? { x: secondaryTile.rx, y: secondaryTile.ry } : undefined;
        });
    }
    orderUnits(unitIds: any[], orderType: any, targetX?: any, targetY?: any, useBridge?: boolean): void {
        this.createAndPushAction(ActionType.SelectUnits, (action) => {
            action.unitIds = unitIds;
        });
        let target: Target | undefined;
        // 完善模拟层逻辑：tile 0 means "no target" / object-id mode, not a real coord.
        if (targetX) {
            let targetObject: any;
            let targetTile: any;
            if (targetY) {
                targetObject = undefined;
                const tile = this.game.map.tiles.getByMapCoords(targetX, targetY);
                if (!tile) {
                    throw new Error(`No tile found at rx,ry=${targetX},${targetY}`);
                }
                targetTile = tile;
                if (useBridge) {
                    targetObject = this.game.map.tileOccupation.getBridgeOnTile(tile);
                }
            }
            else {
                if (!this.game.getWorld().hasObjectId(targetX)) {
                    return;
                }
                targetObject = this.game.getObjectById(targetX);
                targetTile = targetObject.tile;
            }
            target = this.game.createTarget(targetObject, targetTile);
        }
        this.createAndPushAction(ActionType.OrderUnits, (action) => {
            action.orderType = orderType;
            action.target = target;
        });
    }
    sayAll(message: string): void {
        this.chatApi?.sayAll(this.localPlayer.name, message);
    }
    setGlobalDebugText(text?: string): void {
        if (this.localPlayer.getDebugMode()) {
            this.createAndPushAction(ActionType.DebugCommand, (action) => {
                action.command = new DebugCommand(DebugCommandType.SetGlobalDebugText, { text: text || "" });
            });
        }
    }
    setUnitDebugText(unitId: number, label?: string): void {
        if (this.localPlayer.getDebugMode()) {
            this.createAndPushAction(ActionType.DebugCommand, (action) => {
                action.command = new DebugCommand(DebugCommandType.SetUnitDebugText, { unitId, label });
            });
        }
    }
    quitGame(): void {
        this.createAndPushAction(ActionType.ResignGame);
    }
    private createAndPushAction(actionType: ActionType, configureAction?: (action: any) => void): void {
        const action = this.actionFactory.create(actionType);
        action.player = this.game.getPlayerByName(this.localPlayer.name);
        configureAction?.(action);
        this.actionQueue.push(action);
    }
}
