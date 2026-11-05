import { Coords } from '@/game/Coords';
import { CollisionType } from '@/game/gameobject/unit/CollisionType';
import { Warhead } from '@/game/Warhead';
import { TriggerExecutor } from '@/game/trigger/TriggerExecutor';
export class DetonateWarheadExecutor extends TriggerExecutor {
    execute(game: any): void {
        const weaponId = Number(this.action.params[1]);
        const waypointId = this.action.params[6];
        const tile = game.map.getTileAtWaypoint(waypointId);
        if (!tile) {
            console.warn(`No valid location found for waypoint ${waypointId}. ` +
                `Skipping action ${this.getDebugName()}.`);
            return;
        }
        let weapon;
        try {
            weapon = game.rules.getWeaponByInternalId(weaponId);
        }
        catch (error) {
            if (error instanceof RangeError) {
                console.warn(`Weapon with internal ID "${weaponId}" not found. ` +
                    `Skipping action ${this.getDebugName()}.`);
                return;
            }
            throw error;
        }
        let warheadData;
        try {
            warheadData = game.rules.getWarhead(weapon.warhead);
        }
        catch (error) {
            console.warn(`Warhead "${weapon.warhead}" not found. ` +
                `Skipping action ${this.getDebugName()}.`);
            return;
        }
        const warhead = new Warhead(warheadData);
        const bridge = game.map.tileOccupation.getBridgeOnTile(tile);
        const elevation = bridge?.tileElevation ?? 0;
        const zone = game.map.getTileZone(tile);
        warhead.detonate(game, weapon.damage, tile, elevation, Coords.tile3dToWorld(tile.rx + 0.5, tile.ry + 0.5, tile.z + elevation), zone, bridge ? CollisionType.OnBridge : CollisionType.None, game.createTarget(bridge, tile), undefined);
    }
}
