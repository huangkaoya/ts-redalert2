import { ObjectType } from "@/engine/type/ObjectType";
import { BridgeOverlayTypes } from "@/game/map/BridgeOverlayTypes";
import { ScatterTask } from "@/game/gameobject/task/ScatterTask";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { DeathType } from "@/game/gameobject/common/DeathType";
export class CabHutTrait {
    private gameObject: any;
    private bridges: any;
    private checkedClosestBridge: boolean;
    private closestBridge: any;
    constructor(gameObject: any, bridges: any) {
        this.gameObject = gameObject;
        this.bridges = bridges;
        this.checkedClosestBridge = false;
    }
    canRepairBridge(): boolean {
        const bridgeBounds = this.findClosestBridgeBounds();
        if (bridgeBounds) {
            return this.bridges.canBeRepaired(bridgeBounds);
        }
        console.warn(`No bridge associated with hut at ${this.gameObject.tile.rx}, ${this.gameObject.tile.ry}.`);
        return false;
    }
    repairBridge(context: any, player: any): void {
        const bridgeBounds = this.findClosestBridgeBounds();
        if (!bridgeBounds) {
            throw new Error("No bridge bounds found");
        }
        const destroyedTiles = this.bridges.findDestroyedPieceTiles(bridgeBounds);
        const isHorizontal = bridgeBounds.start.rx !== bridgeBounds.end.rx;
        const overlayId = bridgeBounds.isHigh
            ? BridgeOverlayTypes.calculateHighBridgeOverlayId(bridgeBounds.type, isHorizontal)
            : BridgeOverlayTypes.calculateLowBridgeOverlayId(bridgeBounds.type, isHorizontal);
        const overlayName = context.rules.getOverlayName(overlayId);
        for (const tile of destroyedTiles) {
            const overlay = context.createObject(ObjectType.Overlay, overlayName);
            overlay.overlayId = overlayId;
            overlay.value = 0;
            overlay.position.tileElevation = bridgeBounds.isHigh ? 4 : 0;
            context.spawnObject(overlay, tile);
            this.updateUnitsUnderBridgePiece(tile, bridgeBounds, context, player);
        }
        for (const piece of this.bridges.findBridgePieces(bridgeBounds)) {
            piece.obj.bridgeTrait.bridgeSpec = bridgeBounds;
        }
    }
    updateUnitsUnderBridgePiece(tile: any, bridgeSpec: any, context: any, player: any): void {
        for (const pieceTile of this.bridges.getPieceTiles(this.bridges.getPieceAtTile(tile))) {
            if (bridgeSpec.isHigh) {
                const unitsToScatter = context.map
                    .getGroundObjectsOnTile(pieceTile)
                    .filter((obj: any) => obj.tile === pieceTile &&
                    obj.isUnit() &&
                    !obj.unitOrderTrait.hasTasks() &&
                    obj.rules.tooBigToFitUnderBridge);
                unitsToScatter.forEach((unit: any) => unit.unitOrderTrait.addTask(new ScatterTask(context)));
            }
            else {
                for (const obj of context.map.getGroundObjectsOnTile(pieceTile)) {
                    if (obj.isUnit()) {
                        if (context.map.terrain.getPassableSpeed(pieceTile, obj.rules.speedType, obj.isInfantry(), true)) {
                            obj.zone = ZoneType.Ground;
                            obj.onBridge = true;
                        }
                        else if (!obj.isDestroyed) {
                            context.destroyObject(obj, { player });
                        }
                    }
                }
            }
        }
    }
    demolishBridge(context: any, attacker: any): void {
        const pieces = this.getBridgePieces();
        if (pieces) {
            for (const piece of pieces) {
                if ((piece.obj.isLowBridge() &&
                    context.map.getTileZone(piece.obj.tile, true) !== ZoneType.Water) ||
                    piece.obj.isDestroyed) {
                    continue;
                }
                piece.obj.deathType = DeathType.Demolish;
                context.destroyObject(piece.obj, attacker, true);
            }
        }
    }
    getBridgePieces(): any[] | undefined {
        const bridgeBounds = this.findClosestBridgeBounds();
        if (bridgeBounds) {
            return this.bridges.findBridgePieces(bridgeBounds);
        }
    }
    findClosestBridgeBounds(): any {
        if (!this.checkedClosestBridge) {
            this.checkedClosestBridge = true;
            this.closestBridge = this.bridges.findClosestBridgeSpec(this.gameObject.tile);
        }
        return this.closestBridge;
    }
    dispose(): void {
        this.gameObject = undefined;
    }
}
