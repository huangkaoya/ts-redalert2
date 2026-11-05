import { PowerupType } from '@/game/type/PowerupType';
import { TriggerExecutor } from '@/game/trigger/TriggerExecutor';
const powerupTypeMap = new Map<number, PowerupType | ((game: any) => any)>([
    [
        0,
        (game) => {
            const powerup = game.rules.powerups.powerups.find((p: any) => p.type === PowerupType.Money);
            return powerup ? { ...powerup, data: "5000" } : undefined;
        },
    ],
    [1, PowerupType.Unit],
    [2, PowerupType.HealBase],
    [3, PowerupType.Cloak],
    [4, PowerupType.Explosion],
    [5, PowerupType.Napalm],
    [6, PowerupType.Money],
    [7, PowerupType.Darkness],
    [8, PowerupType.Reveal],
    [9, PowerupType.Armor],
    [10, PowerupType.Speed],
    [11, PowerupType.Firepower],
    [12, PowerupType.ICBM],
    [13, undefined],
    [14, PowerupType.Veteran],
    [15, undefined],
    [16, PowerupType.Gas],
    [17, PowerupType.Tiberium],
    [18, undefined],
]);
export class CreateCrateExecutor extends TriggerExecutor {
    execute(game: any): void {
        const typeId = Number(this.action.params[1]);
        const waypointId = this.action.params[6];
        const tile = game.map.getTileAtWaypoint(waypointId);
        if (!tile) {
            console.warn(`No valid location found for waypoint ${waypointId}. ` +
                `Skipping action ${this.getDebugName()}.`);
            return;
        }
        // 完善模拟层逻辑：search nearby radius 3; timed lifetime follows cratesAppear.
        const cratesAppear = game.gameOpts.cratesAppear;
        if (powerupTypeMap.has(typeId)) {
            const powerupType = powerupTypeMap.get(typeId);
            const powerup = typeof powerupType === 'function'
                ? powerupType(game)
                : game.rules.powerups.powerups.find((p: any) => p.type === powerupType);
            if (powerup) {
                game.crateGeneratorTrait.spawnCrateAt(tile, powerup, game, 3, cratesAppear);
            }
        }
        else {
            game.crateGeneratorTrait.spawnRandomCrateAt(tile, game, 3, cratesAppear);
        }
    }
}
