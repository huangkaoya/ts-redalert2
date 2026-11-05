import { PointerType } from '@/engine/type/PointerType';
import { Coords } from '@/game/Coords';
import { isNotNullOrUndefined } from '@/util/typeGuard';
import { EventDispatcher } from '@/util/event';
import { MoveOrder } from '@/game/order/MoveOrder';
import { orderPriorities } from '@/game/order/orderPriorities';
import { OrderFactory } from '@/game/order/OrderFactory';
import { AttackOrder } from '@/game/order/AttackOrder';
import { Target } from '@/game/Target';
import { AttackMoveOrder } from '@/game/order/AttackMoveOrder';
import { OrderFeedbackType } from '@/game/order/OrderFeedbackType';
import { GuardAreaOrder } from '@/game/order/GuardAreaOrder';
class SelectAction {
    private force = false;
    private allowTypeSelect = false;
    constructor(private readonly game: any, private readonly unitSelectionHandler: any, private readonly currentPlayer: any, private readonly toggleSelect: boolean = false) { }
    setForce(force: boolean): this {
        this.force = force;
        return this;
    }
    setTypeSelect(allowTypeSelect: boolean): this {
        this.allowTypeSelect = allowTypeSelect;
        return this;
    }
    getPointerType(): PointerType {
        return PointerType.Select;
    }
    isAllowed(): boolean {
        return true;
    }
    isValidTarget(target: any): boolean {
        if (!target?.isTechno?.()) {
            return false;
        }
        if (this.currentPlayer &&
            (target.isInfantry?.() || target.isVehicle?.()) &&
            target.disguiseTrait?.hasTerrainDisguise?.() &&
            !this.game.alliances.haveSharedIntel(this.currentPlayer, target.owner)) {
            return false;
        }
        const selected = this.unitSelectionHandler.getSelectedUnits();
        const targetAlreadySelected = selected.includes(target);
        const canCollapseMultipleSelection = !this.toggleSelect &&
            targetAlreadySelected &&
            selected.length > 1 &&
            selected.every((unit: any) => unit.owner === target.owner);
        if (!this.toggleSelect &&
            selected.some((unit: any) => unit.isUnit?.()) &&
            this.currentPlayer &&
            !this.currentPlayer.isObserver &&
            target.isTechno?.() &&
            !this.game.areFriendly(target, selected[0]) &&
            selected[0].owner === this.currentPlayer) {
            return false;
        }
        return (target.rules.selectable &&
            (this.toggleSelect ||
                this.force ||
                (this.allowTypeSelect && selected.length === 1 && selected[0] === target) ||
                !targetAlreadySelected ||
                canCollapseMultipleSelection));
    }
    execute(target: any): void {
        if (this.allowTypeSelect) {
            const selected = this.unitSelectionHandler.getSelectedUnits();
            if (selected.length === 1 && selected[0] === target) {
                this.unitSelectionHandler.selectByType();
                return;
            }
        }
        if (this.toggleSelect) {
            this.unitSelectionHandler.toggleSelection(target);
        }
        else {
            this.unitSelectionHandler.selectSingleUnit(target);
        }
    }
}
export enum ActionFilter {
    All = 0,
    SelectOnly = 1,
    NoSelect = 2
}
export class DefaultActionHandler {
    private readonly _onOrder = new EventDispatcher<any, any>();
    private selectAction!: SelectAction;
    private selectToggleAction?: SelectAction;
    private forceMoveAction?: any;
    private forceAttackAction?: any;
    private attackMoveAction?: any;
    private guardAreaAction?: any;
    private defaultActions: any[] = [];
    private specialActions: any[] = [];
    private currentTarget?: any;
    private currentSelected?: any[];
    private currentHover?: any;
    private mostSignificantAction?: any;
    get onOrder() {
        return this._onOrder.asEvent();
    }
    static factory(renderableManager: any, unitSelection: any, unitSelectionHandler: any, currentPlayer: any, map: any, game: any, audioVisualRules: any): DefaultActionHandler {
        const handler = new DefaultActionHandler(renderableManager, currentPlayer, audioVisualRules, map);
        const selectAction = new SelectAction(game, unitSelectionHandler, currentPlayer);
        handler.selectAction = selectAction;
        if (currentPlayer && !currentPlayer.isObserver) {
            handler.defaultActions = [
                ...orderPriorities.map((orderType) => new OrderFactory(game, map).create(orderType, unitSelection)),
                selectAction,
                new MoveOrder(game, map, unitSelection),
            ];
            handler.selectToggleAction = new SelectAction(game, unitSelectionHandler, currentPlayer, true);
            handler.forceMoveAction = new MoveOrder(game, map, unitSelection, true);
            handler.forceAttackAction = new AttackOrder(game, { forceAttack: true });
            handler.attackMoveAction = new AttackMoveOrder(game, map);
            handler.guardAreaAction = new GuardAreaOrder(game, true);
            handler.specialActions = [
                handler.selectToggleAction,
                handler.forceMoveAction,
                handler.forceAttackAction,
                handler.attackMoveAction,
                handler.guardAreaAction,
            ];
        }
        else {
            handler.defaultActions = [selectAction];
            handler.specialActions = [];
        }
        return handler;
    }
    constructor(private readonly renderableManager: any, private readonly currentPlayer: any, private readonly audioVisualRules: any, private readonly map: any) { }
    private createOrderTarget(hover: any): Target {
        return new Target(hover?.gameObject, hover?.tile, this.map.tileOccupation);
    }
    private createTargetForAction(hover: any, sourceObject: any, action: any): Target {
        if (action instanceof MoveOrder ||
            action instanceof AttackMoveOrder ||
            action instanceof GuardAreaOrder) {
            const hoverObjectIsBridge = hover?.gameObject?.isOverlay?.() && hover.gameObject.isBridge?.();
            // 完善模拟层逻辑：OrderUnits: createTarget(bridgeOverlay, tile) when targeting a bridge.
            if (hoverObjectIsBridge) {
                const bridgeTile = hover?.bridgeTile ?? hover.tile;
                return new Target(hover.gameObject, bridgeTile, this.map.tileOccupation);
            }
            if (hover?.bridgeTile) {
                const bridge = this.map.tileOccupation.getBridgeOnTile(hover.bridgeTile);
                if (bridge) {
                    return new Target(bridge, hover.bridgeTile, this.map.tileOccupation);
                }
            }
            return this.createOrderTarget(hover);
        }
        return this.createOrderTarget(hover);
    }
    private getDefaultAction(sourceObject: any, selected: any[], hover: any, filter: ActionFilter, force: boolean, allowTypeSelect: boolean, keyboardEvent: any, minimap: boolean): any {
        const hoveredObject = hover.gameObject;
        const selectAction = this.selectAction.setForce(force).setTypeSelect(false);
        if (!sourceObject || sourceObject.owner !== this.currentPlayer || sourceObject.rules.spawned) {
            return !minimap && filter !== ActionFilter.NoSelect && selectAction.isValidTarget(hoveredObject)
                ? selectAction
                : undefined;
        }
        if (filter !== ActionFilter.NoSelect &&
            !minimap &&
            keyboardEvent?.shiftKey &&
            !keyboardEvent?.ctrlKey &&
            this.selectToggleAction?.isValidTarget(hoveredObject)) {
            return this.selectToggleAction;
        }
        if (filter === ActionFilter.SelectOnly) {
            return !minimap && selectAction.setTypeSelect(allowTypeSelect).isValidTarget(hoveredObject)
                ? selectAction
                : undefined;
        }
        const allWarpedOut = selected.every((unit) => unit.warpedOutTrait?.isActive?.());
        if (keyboardEvent?.ctrlKey && !allWarpedOut) {
            if (keyboardEvent.shiftKey) {
                const target = this.attackMoveAction && this.createTargetForAction(hover, sourceObject, this.attackMoveAction);
                if (target && this.attackMoveAction.set(sourceObject, target).isValid()) {
                    return this.attackMoveAction;
                }
            }
            else if (keyboardEvent.altKey) {
                const target = this.guardAreaAction && this.createTargetForAction(hover, sourceObject, this.guardAreaAction);
                if (target && this.guardAreaAction.set(sourceObject, target).isValid()) {
                    return this.guardAreaAction;
                }
            }
            else if (this.forceAttackAction) {
                const target = this.createTargetForAction(hover, sourceObject, this.forceAttackAction);
                if (this.forceAttackAction.set(sourceObject, target).isValid()) {
                    return this.forceAttackAction;
                }
            }
        }
        if (keyboardEvent?.altKey && !allWarpedOut && this.forceMoveAction) {
            const target = this.createTargetForAction(hover, sourceObject, this.forceMoveAction);
            if (this.forceMoveAction.set(sourceObject, target).isValid()) {
                return this.forceMoveAction;
            }
        }
        for (const action of this.defaultActions) {
            if (action instanceof SelectAction) {
                if (filter !== ActionFilter.NoSelect && !minimap && action.setForce(force).setTypeSelect(false).isValidTarget(hoveredObject)) {
                    return action;
                }
            }
            else if (!allWarpedOut &&
                (!minimap || action.minimapAllowed) &&
                !(action.singleSelectionRequired && selected.length > 1) &&
                action.set(sourceObject, this.createTargetForAction(hover, sourceObject, action)).isValid()) {
                return action;
            }
        }
        if (minimap && !allWarpedOut && this.forceMoveAction) {
            const target = this.createTargetForAction(hover, sourceObject, this.forceMoveAction);
            if (this.forceMoveAction.set(sourceObject, target).isValid()) {
                return this.forceMoveAction;
            }
        }
        return undefined;
    }
    private updateMostSignificantAction(selected: any[], hover: any, filter: ActionFilter, force: boolean, allowTypeSelect: boolean, keyboardEvent: any, minimap: boolean): any {
        if (!selected.length) {
            return this.getDefaultAction(undefined, selected, hover, filter, force, allowTypeSelect, keyboardEvent, minimap);
        }
        const actions = selected
            .map((unit) => {
            const action = this.getDefaultAction(unit, selected, hover, filter, force, allowTypeSelect, keyboardEvent, minimap);
            if (action) {
                return {
                    unit,
                    action,
                    target: action instanceof SelectAction ? undefined : action.target,
                };
            }
            return undefined;
        })
            .filter(isNotNullOrUndefined);
        const specialActions = [...this.specialActions.values()];
        if (!actions.length) {
            return undefined;
        }
        return actions.reduce((best: any, entry: any) => {
            if (!best) {
                return entry.action instanceof SelectAction ? entry.action : entry.action.set(entry.unit, entry.target);
            }
            const bestIndex = this.defaultActions.indexOf(best);
            const currentIndex = this.defaultActions.indexOf(entry.action);
            const currentBeatsBest = specialActions.includes(entry.action) ||
                currentIndex < bestIndex ||
                (!(best instanceof SelectAction) &&
                    best.sourceObject?.rules?.leadershipRating < entry.unit.rules.leadershipRating &&
                    currentIndex === bestIndex);
            return currentBeatsBest
                ? entry.action instanceof SelectAction
                    ? entry.action
                    : entry.action.set(entry.unit, entry.target)
                : best;
        }, undefined);
    }
    getPointerType(minimap: boolean): PointerType {
        if (this.mostSignificantAction instanceof SelectAction) {
            return this.mostSignificantAction.getPointerType();
        }
        if (!this.currentSelected || !this.mostSignificantAction) {
            return minimap ? PointerType.Mini : PointerType.Default;
        }
        if (!this.mostSignificantAction.isAllowed()) {
            const sourceObject = this.mostSignificantAction.sourceObject;
            const target = this.mostSignificantAction.target;
            for (const unit of this.currentSelected) {
                this.mostSignificantAction.set(
                    unit,
                    this.currentHover
                        ? this.createTargetForAction(this.currentHover, unit, this.mostSignificantAction)
                        : this.currentTarget,
                );
                if (this.mostSignificantAction.isValid() && this.mostSignificantAction.isAllowed()) {
                    return this.mostSignificantAction.getPointerType(minimap, this.currentSelected);
                }
            }
            this.mostSignificantAction.set(sourceObject, target);
        }
        return this.mostSignificantAction.getPointerType(minimap, this.currentSelected);
    }
    update(hover: any, selected: any[], rightClickMove: boolean, keyboardEvent: any, minimap: boolean = false): void {
        this.currentHover = hover;
        this.currentSelected = selected;
        this.mostSignificantAction = this.updateMostSignificantAction(selected, hover, ActionFilter.All, rightClickMove, false, keyboardEvent, minimap);
        this.currentTarget = this.mostSignificantAction instanceof SelectAction
            ? this.createOrderTarget(hover)
            : this.mostSignificantAction?.target ?? this.createOrderTarget(hover);
    }
    execute(hover: any, selected: any[], filter: ActionFilter, force: boolean, allowTypeSelect: boolean, keyboardEvent: any, minimap: boolean = false): boolean {
        this.currentHover = hover;
        this.currentSelected = selected;
        this.mostSignificantAction = this.updateMostSignificantAction(selected, hover, filter, force, allowTypeSelect, keyboardEvent, minimap);
        if (!this.mostSignificantAction) {
            return false;
        }
        const target = (this.currentTarget = this.mostSignificantAction instanceof SelectAction
            ? this.createOrderTarget(hover)
            : this.mostSignificantAction.target);
        const allowed = this.mostSignificantAction.isAllowed();
        if (allowed) {
            if (this.mostSignificantAction instanceof MoveOrder ||
                (this.mostSignificantAction instanceof AttackMoveOrder && !target.obj?.isTechno?.()) ||
                this.mostSignificantAction instanceof GuardAreaOrder) {
                this.renderableManager.createTransientAnim(this.audioVisualRules.moveFlash, (renderable: any) => {
                    const bridge = target.getBridge?.();
                    renderable.setPosition(Coords.tile3dToWorld(target.tile.rx + 0.5, target.tile.ry + 0.5, target.tile.z + (bridge?.tileElevation ?? 0)));
                });
            }
            else if (!(this.mostSignificantAction instanceof SelectAction) && !selected.includes(hover.gameObject)) {
                hover.entity?.highlight?.();
            }
        }
        if (this.mostSignificantAction instanceof SelectAction) {
            this.mostSignificantAction.execute(hover.gameObject);
        }
        else {
            this._onOrder.dispatch(this, {
                orderType: this.mostSignificantAction.orderType,
                terminal: this.mostSignificantAction.terminal,
                feedbackType: allowed ? this.mostSignificantAction.feedbackType : OrderFeedbackType.None,
                feedbackUnit: allowed ? this.mostSignificantAction.sourceObject : undefined,
                target,
            });
        }
        return true;
    }
}
