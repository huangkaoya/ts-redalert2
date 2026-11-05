import { TriggerExecutor } from '@/game/trigger/TriggerExecutor';
export class ChangeHouseAllExecutor extends TriggerExecutor {
    private static readonly locationHouseIdBegin: number = 4475;
    public execute(game: any): void {
        const sourcePlayer = game
            .getAllPlayers()
            .find((player: any) => player.country?.name === this.trigger.houseName);
        if (!sourcePlayer) {
            return;
        }
        const targetHouseId = Number(this.action.params[1]);
        let targetPlayer;
        if (targetHouseId >= ChangeHouseAllExecutor.locationHouseIdBegin &&
            targetHouseId < ChangeHouseAllExecutor.locationHouseIdBegin + game.map.startingLocations.length) {
            const locationIndex = targetHouseId - ChangeHouseAllExecutor.locationHouseIdBegin;
            targetPlayer = game.getAllPlayers().find((player: any) => player.startLocation === locationIndex);
        }
        else {
            targetPlayer = game.getAllPlayers().find((player: any) => player.country?.id === targetHouseId);
        }
        if (targetPlayer?.defeated) {
            targetPlayer = game.isAssetRedistributionEnabled()
                ? game.alliances.getAllies(sourcePlayer)[0]
                : undefined;
        }
        if (!targetPlayer) {
            return;
        }
        for (const ownedObject of sourcePlayer.getOwnedObjects(true)) {
            game.changeObjectOwner(ownedObject, targetPlayer);
        }
    }
}
