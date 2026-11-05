import { GameObject } from '@/game/gameobject/GameObject';
import { TriggerExecutor } from '@/game/trigger/TriggerExecutor';
export class ChangeHouseExecutor extends TriggerExecutor {
    private static readonly locationHouseIdBegin: number = 4475;
    private readonly houseId: number;
    constructor(action: any, context: any) {
        super(action, context);
        this.houseId = Number(action.params[1]);
    }
    execute(game: any, objects: any[]): void {
        let targetPlayer;
        if (this.houseId >= ChangeHouseExecutor.locationHouseIdBegin &&
            this.houseId < ChangeHouseExecutor.locationHouseIdBegin + game.map.startingLocations.length) {
            const locationIndex = this.houseId - ChangeHouseExecutor.locationHouseIdBegin;
            targetPlayer = game.getAllPlayers().find((player: any) => player.startLocation === locationIndex);
        }
        else {
            targetPlayer = game.getAllPlayers().find((player: any) => player.country?.id === this.houseId);
        }
        // 完善模拟层逻辑：defeated target → first ally of the TARGET house when
        // redistribution is enabled; otherwise skip the transfer entirely.
        // (ChangeHouseAllExecutor uses getAllies(source); this executor uses target.)
        if (targetPlayer?.defeated) {
            targetPlayer = game.isAssetRedistributionEnabled()
                ? game.alliances.getAllies(targetPlayer)[0]
                : undefined;
        }
        if (targetPlayer) {
            for (const obj of objects) {
                if (obj instanceof GameObject && obj.isSpawned) {
                    game.changeObjectOwner(obj, targetPlayer);
                }
            }
        }
    }
}
