import { ReadonlyPlayerApi, type PlayerGameApi } from '@/game/api/ReadonlyPlayerApi';

export type { PlayerGameApi };

export class PlayerApi extends ReadonlyPlayerApi {
    actions: unknown;

    constructor(
        name: string,
        gameApi: PlayerGameApi,
        actions: unknown,
        production: unknown,
    ) {
        super(name, gameApi, production);
        this.actions = actions;
    }
}
