import type { BotContext } from '@/game/bot/BotContext';

export class Bot {
    name: string;
    country: string;
    protected context?: BotContext<any, any, any>;
    private debugMode = false;

    get game(): any {
        return this.context?.game;
    }

    get player(): any {
        return this.context?.player;
    }

    get gameApi(): any {
        return this.context?.game;
    }

    get actionsApi(): any {
        return this.context?.player.actions;
    }

    get productionApi(): any {
        return this.context?.player.production;
    }

    get logger(): any {
        return this.context?.logger;
    }

    constructor(name: string, country: string) {
        this.name = name;
        this.country = country;
    }

    setContext(context: BotContext<any, any, any>): void {
        this.context = context;
        this.context.logger.setDebugLevel(this.debugMode);
    }

    setGameApi(_api: any): void {}

    setActionsApi(_api: any): void {}

    setProductionApi(_api: any): void {}

    setLogger(_logger: any): void {}

    setDebugMode(debug: boolean): Bot {
        this.debugMode = debug;
        this.context?.logger.setDebugLevel(debug);
        return this;
    }

    getDebugMode(): boolean {
        return this.debugMode;
    }

    onGameInit(_gameApi: any): void {}

    onGameStart(_gameApi: any): void {}

    onGameTick(_gameApi: any): void {}

    onGameEvent(_event: any, _gameApi: any): void {}
}
