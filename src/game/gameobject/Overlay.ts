import { ObjectType } from '@/engine/type/ObjectType';
import { GameObject } from '@/game/gameobject/GameObject';
import { BridgeOverlayTypes } from '@/game/map/BridgeOverlayTypes';
import { OreOverlayTypes } from '@/game/map/OreOverlayTypes';
import { WallTrait } from '@/game/gameobject/trait/WallTrait';
import { LandType } from '@/game/type/LandType';
export class Overlay extends GameObject {
    radarInvisible: boolean;
    wallTrait?: WallTrait;
    static factory(id: string, rules: any, owner: any): Overlay {
        const overlay = new this(id, rules, owner);
        if (rules.wall) {
            overlay.wallTrait = new WallTrait();
            overlay.traits.add(overlay.wallTrait);
        }
        return overlay;
    }
    constructor(id: string, rules: any, owner: any) {
        super(ObjectType.Overlay, id, rules, owner);
        this.radarInvisible = this.rules.radarInvisible;
    }
    isTiberium(): boolean {
        return OreOverlayTypes.getOverlayTibType(this.overlayId) !== undefined;
    }
    isBridge(): boolean {
        return BridgeOverlayTypes.isBridge(this.overlayId);
    }
    isXBridge(): boolean {
        return BridgeOverlayTypes.isXBridge(this.overlayId);
    }
    isHighBridge(): boolean {
        return BridgeOverlayTypes.isHighBridge(this.overlayId);
    }
    isLowBridge(): boolean {
        return BridgeOverlayTypes.isLowBridge(this.overlayId);
    }
    isBridgePlaceholder(): boolean {
        return BridgeOverlayTypes.isBridgePlaceholder(this.overlayId);
    }
    getFoundation(): {
        width: number;
        height: number;
    } {
        const foundation = { width: 1, height: 1 };
        if (this.isBridge()) {
            if (this.isXBridge()) {
                foundation.height += 2;
            }
            else {
                foundation.width += 2;
            }
        }
        return foundation;
    }

    getLandType(): LandType {
        return this.rules.wall
            ? LandType.Wall
            : this.isTiberium()
              ? LandType.Tiberium
              : this.isBridge() && this.isHighBridge()
                ? LandType.Road
                : this.rules.land;
    }
}
