import { TriggerExecutor } from '@/game/trigger/TriggerExecutor';
import { Game } from '@/game/Game';
import { Player } from '@/game/Player';
import { Building } from '@/game/Building';
export class FireSaleExecutor extends TriggerExecutor {
    private readonly houseId: number;
    constructor(action: any, game: Game) {
        super(action, game);
        this.houseId = Number(action.params[1]);
    }
    execute(game: Game): void {
        const targetPlayer = game.getAllPlayers().find((player: Player) => player.country?.id === this.houseId as any);
        if (targetPlayer) {
            for (const building of targetPlayer.buildings) {
                game.sellTrait.sell(building);
            }
        }
    }
}
