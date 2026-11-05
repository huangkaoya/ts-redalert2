export class BotContext<Game = unknown, Player = unknown, Logger = unknown> {
    game: Game;
    player: Player;
    logger: Logger;

    constructor(game: Game, player: Player, logger: Logger) {
        this.game = game;
        this.player = player;
        this.logger = logger;
    }
}
