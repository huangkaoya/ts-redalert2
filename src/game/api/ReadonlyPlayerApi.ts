export type PlayerUnitVisibility = 'self' | 'allied' | 'hostile' | 'enemy';

export interface PlayerGameApi {
    getPlayerData(playerName: string): unknown;
    isPlayerDefeated(playerName: string): boolean;
    areAlliedPlayers(playerName: string, otherPlayerName: string): boolean;
    canPlaceBuilding(
        playerName: string,
        buildingName: string,
        tile: { rx?: number; ry?: number; x?: number; y?: number },
        options?: Record<string, unknown>,
    ): boolean;
    getVisibleUnits(
        playerName: string,
        visibility: PlayerUnitVisibility,
        filter?: (rule: unknown) => boolean,
    ): number[];
}

const gameApiByPlayerApi = new WeakMap<object, PlayerGameApi>();

export class ReadonlyPlayerApi {
    name: string;
    production: unknown;

    constructor(name: string, gameApi: PlayerGameApi, production: unknown) {
        this.name = name;
        this.production = production;
        gameApiByPlayerApi.set(this, gameApi);
    }

    protected get gameApi(): PlayerGameApi {
        return gameApiByPlayerApi.get(this)!;
    }

    getPlayerData(): unknown {
        return this.gameApi.getPlayerData(this.name);
    }

    isDefeated(): boolean {
        return this.gameApi.isPlayerDefeated(this.name);
    }

    isAlliedWith(otherPlayerName: string): boolean {
        return this.gameApi.areAlliedPlayers(this.name, otherPlayerName);
    }

    canPlaceBuilding(
        buildingName: string,
        tile: { rx?: number; ry?: number; x?: number; y?: number },
    ): boolean {
        return this.gameApi.canPlaceBuilding(this.name, buildingName, tile);
    }

    getVisibleUnits(
        visibility: PlayerUnitVisibility,
        filter: (rule: unknown) => boolean = () => true,
    ): number[] {
        return this.gameApi.getVisibleUnits(this.name, visibility, filter);
    }
}
