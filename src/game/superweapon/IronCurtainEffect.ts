import { RadialTileFinder } from "@/game/map/tileFinder/RadialTileFinder";
import { SuperWeaponEffect } from "@/game/superweapon/SuperWeaponEffect";
import { Game } from "@/game/Game";
export class IronCurtainEffect extends SuperWeaponEffect {
    onStart(game: Game) {
        const duration = game.rules.combatDamage.ironCurtainDuration;
        const source = { player: this.owner };
        const tileFinder = new RadialTileFinder(game.map.tiles, game.map.mapBounds, this.tile, { width: 1, height: 1 }, 0, 1, () => true);
        let tile;
        while ((tile = tileFinder.getNextTile())) {
            for (const object of game.map.getGroundObjectsOnTile(tile)) {
                // 完善模拟层逻辑：skip destroyed before organic/invuln branch.
                if (!object.isTechno() ||
                    object.isDestroyed ||
                    (object.isUnit() && object.tile !== tile) ||
                    object.rules.missileSpawn) {
                    continue;
                }
                if (object.rules.organic) {
                    game.destroyObject(object, source);
                }
                else {
                    object.invulnerableTrait.setActiveFor(duration, game.currentTick);
                    if ((object.isVehicle() || object.isAircraft()) &&
                        object.parasiteableTrait?.isInfested()) {
                        object.parasiteableTrait.destroyParasite(source, game);
                    }
                }
            }
        }
    }
    onTick(game: Game): boolean {
        return true;
    }
}
