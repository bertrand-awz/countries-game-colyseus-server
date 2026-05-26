import { Room, Client, CloseCode } from "colyseus";

import { CountriesGameState, GameStatus } from "#rooms/schema/CountriesGameState.js";
import { CountriesGame } from "#game/CountriesGame.js";
import { GameRoomMessageType } from "#rooms/GameRoomMessageType.js";
import { CountryNameValidator } from "#game/CountryNameValidator.js";

import countriesAnswerValidation from "#data/json/countries-answer-validation.json" with { type: "json" };

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
    maxClients = 8;
    state: CountriesGameState;

    private game!: CountriesGame;
    private gameEndTimeout: NodeJS.Timeout | null = null;

    onCreate(options: CreateOptions): void {
        this.state = new CountriesGameState(options.gameLanguage, options.gameDurationInSeconds);

        this.maxClients = options.maxPlayersAllowed ?? 8;

        const countryNameValidator = new CountryNameValidator(countriesAnswerValidation.countries);

        this.game = new CountriesGame(
            this.state,
            countryNameValidator,
            countriesAnswerValidation.countries.length,
        );

        this.onMessage(
            GameRoomMessageType.SUBMIT_COUNTRY_NAME,
            (client, message: SubmitCountryMessage) => {
                this.handleCountrySubmission(client, message);
            },
        );

        this.onMessage(GameRoomMessageType.PASS_TURN, (client) => {
            this.handlePassTurn(client);
        });

        this.onMessage(GameRoomMessageType.START_GAME, (client) => {
            this.startGame(client);
        });

        this.onMessage(GameRoomMessageType.PAUSE_GAME, (client) => {
            this.pauseGame(client);
        });

        this.onMessage(GameRoomMessageType.RESUME_GAME, (client) => {
            this.resumeGame(client);
        });

        this.onMessage(GameRoomMessageType.END_GAME, (client) => {
            this.endGame(client);
        });
    }

    onJoin(client: Client, options: JoinOptions): void {
        const username = options.username || `Player-${client.sessionId.slice(0, 4)}`;

        this.game.addPlayer(client.sessionId, username);

        this.broadcast(GameRoomMessageType.PLAYER_JOIN_ROOM, {
            playerSessionId: client.sessionId,
            username,
            numberOfPlayers: this.state.numberOfPlayers,
            currentPlayerSessionId: this.game.getCurrentPlayerSessionId(),
        });
    }

    onLeave(client: Client, code: CloseCode): void {
        const player = this.state.getPlayer(client.sessionId);
        const username = player?.username ?? `Player-${client.sessionId.slice(0, 4)}`;

        this.game.removePlayer(client.sessionId);

        this.broadcast(GameRoomMessageType.PLAYER_LEFT_ROOM, {
            playerSessionId: client.sessionId,
            username,
            numberOfPlayers: this.state.numberOfPlayers,
            currentPlayerSessionId: this.game.getCurrentPlayerSessionId(),
            code,
        });

        if (this.state.status !== GameStatus.PLAYING) {
            this.clearGameEndTimeout();
        }
    }

    onDispose(): void {
        this.clearGameEndTimeout();

        console.log("room", this.roomId, "disposing...");
    }

    private startGame(client: Client): void {
        const result = this.game.start();

        if (!result.accepted) {
            client.send(GameRoomMessageType.START_GAME_REJECTED, result);
            return;
        }

        this.scheduleGameEnd();

        this.broadcast(GameRoomMessageType.GAME_STARTED, {
            startAt: result.startAt,
            endAt: result.endAt,
            durationInSeconds: this.state.durationInSeconds,
            currentPlayerSessionId: result.currentPlayerSessionId,
            startedBy: client.sessionId,
        });
    }

    private pauseGame(client: Client): void {
        const result = this.game.pause();

        if (!result.accepted) {
            client.send(GameRoomMessageType.PAUSE_GAME_REJECTED, result);
            return;
        }

        this.clearGameEndTimeout();

        this.broadcast(GameRoomMessageType.GAME_PAUSED, {
            pausedAt: result.pausedAt,
            pausedBy: client.sessionId,
        });
    }

    private resumeGame(client: Client): void {
        const result = this.game.resume();

        if (!result.accepted) {
            client.send(GameRoomMessageType.RESUME_GAME_REJECTED, result);
            return;
        }

        this.scheduleGameEnd();

        this.broadcast(GameRoomMessageType.GAME_RESUMED, {
            resumedAt: result.resumedAt,
            endAt: result.endAt,
            resumedBy: client.sessionId,
        });
    }

    private endGame(client: Client): void {
        this.finishGame("MANUAL_END", client.sessionId);
    }

    private handleCountrySubmission(client: Client, message: SubmitCountryMessage): void {
        const result = this.game.submitAnswer(client.sessionId, message.countryName);

        client.send(GameRoomMessageType.SUBMIT_COUNTRY_NAME_RESULT, result);

        this.broadcast(GameRoomMessageType.COUNTRY_SUBMITTED, {
            result,
            currentPlayerSessionId: this.game.getCurrentPlayerSessionId(),
        });

        if (this.state.status === GameStatus.FINISHED) {
            this.finishGame("ALL_COUNTRIES_FOUND");
        }
    }

    private handlePassTurn(client: Client): void {
        const result = this.game.passTurn(client.sessionId);

        client.send(GameRoomMessageType.PASS_TURN_RESULT, result);

        this.broadcast(GameRoomMessageType.TURN_PASSED, {
            result,
            currentPlayerSessionId: this.game.getCurrentPlayerSessionId(),
        });

        if (this.state.status === GameStatus.FINISHED) {
            this.finishGame("TIME_EXPIRED");
        }
    }

    private scheduleGameEnd(): void {
        this.clearGameEndTimeout();

        const remainingMilliseconds = Math.max(0, this.state.endAt - Date.now());

        this.gameEndTimeout = setTimeout(() => {
            this.finishGame("TIME_EXPIRED");
        }, remainingMilliseconds);
    }

    private finishGame(
        reason: "TIME_EXPIRED" | "MANUAL_END" | "ALL_COUNTRIES_FOUND",
        endedBy?: string,
    ): void {
        this.clearGameEndTimeout();

        this.game.finish();

        this.broadcast(GameRoomMessageType.GAME_FINISHED, {
            reason,
            endedBy,
            finishedAt: Date.now(),
        });
    }

    private clearGameEndTimeout(): void {
        if (!this.gameEndTimeout) {
            return;
        }

        clearTimeout(this.gameEndTimeout);
        this.gameEndTimeout = null;
    }
}
