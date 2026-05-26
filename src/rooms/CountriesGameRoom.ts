import { Room, Client, CloseCode } from "colyseus";
import { CountriesGameState, GameStatus } from "#rooms/schema/CountriesGameState.js";
import { PlayerState } from "#rooms/schema/PlayerState.js";
import { CountriesGame } from "#game/CountriesGame.js";

type JoinOptions = {
    username?: string;
};

type CreateOptions = {
    gameLanguage: string;
    gameDurationInSeconds: number;
    maxPlayersAllowed: number;
};

type SubmitCountryMessage = {
    countryName: string;
};

export class CountriesGameRoom extends Room {
    maxClients: number = 8;
    state: CountriesGameState;
    game: CountriesGame;

    private gameTimeout?: ReturnType<typeof this.clock.setTimeout>;

    onCreate(options: CreateOptions) {
        this.state = new CountriesGameState(options.gameLanguage, options.gameDurationInSeconds);

        this.maxClients = options.maxPlayersAllowed;

        this.onMessage("submit-country", (client, message: SubmitCountryMessage) => {
            this.handleCountrySubmission(client, message);
        });

        this.onMessage("start-game", (client) => {
            this.startGame();
        });
    }

    onJoin(client: Client, options: JoinOptions) {
        const username = options.username || `Player-${client.sessionId.slice(0, 4)}`;

        this.state.addPlayer(client.sessionId, new PlayerState(username));

        console.log(client.sessionId, "joined!");
    }

    onLeave(client: Client, code: CloseCode) {
        this.state.removePlayer(client.sessionId);

        console.log(client.sessionId, "left!", code);
    }

    onDispose() {
        this.gameTimeout?.clear();

        console.log("room", this.roomId, "disposing...");
    }

    private startGame() {
        if (this.state.status !== GameStatus.WAITING) {
            return;
        }

        const now = Date.now();

        this.state.startAt = now;
        this.state.endAt = now + this.state.durationInSeconds * 1000;
        this.state.status = GameStatus.PLAYING;

        this.gameTimeout = this.clock.setTimeout(() => {
            this.endGame();
        }, this.state.durationInSeconds * 1000);
    }

    private endGame() {
        if (this.state.status === GameStatus.FINISHED) {
            return;
        }

        this.state.status = GameStatus.FINISHED;

        this.broadcast("game-ended", {
            endedAt: Date.now(),
        });
    }

    private handleCountrySubmission(client: Client, message: SubmitCountryMessage) {
        if (this.state.status !== GameStatus.PLAYING) {
            return;
        }

        if (Date.now() >= this.state.endAt) {
            this.endGame();
            return;
        }

        const player = this.state.getPlayer(client.sessionId);
        if (!player) return;

        const countryName = message.countryName.trim();

        if (!countryName) return;

        // TODO:
        // 1. vérifier si le pays existe
        // 2. vérifier s'il n'a pas déjà été trouvé
        // 3. ajouter les points
        // 4. mettre à jour le continent
        // 5. broadcast le résultat aux joueurs
    }
}
