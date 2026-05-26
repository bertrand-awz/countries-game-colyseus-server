import { TurnManager } from "./TurnManager.js";
import { CountriesGameState, GameStatus } from "#rooms/schema/CountriesGameState.js";
import { PlayerState } from "#rooms/schema/PlayerState.js";
import { CountryNameValidator, type CountryValidationResult } from "./CountryNameValidator.js";

export type SubmitAnswerResult =
    | {
          accepted: true;
          playerSessionId: string;
          countryCode: string;
          continentCode: string;
          canonicalName: string;
          pointsAwarded: number;
          currentPlayerSessionId: string;
          nextPlayerSessionId: string;
      }
    | {
          accepted: false;
          playerSessionId: string;
          reason:
              | "GAME_NOT_PLAYING"
              | "NOT_YOUR_TURN"
              | "EMPTY_ANSWER"
              | "WRONG_ANSWER"
              | "COUNTRY_ALREADY_FOUND";
          currentPlayerSessionId: string;
          nextPlayerSessionId: string;
      };

export type PassTurnResult =
    | {
          accepted: true;
          playerSessionId: string;
          currentPlayerSessionId: string;
          nextPlayerSessionId: string;
      }
    | {
          accepted: false;
          playerSessionId: string;
          reason: "GAME_NOT_PLAYING" | "NOT_YOUR_TURN";
          currentPlayerSessionId: string;
          nextPlayerSessionId: string;
      };

export class CountriesGame {
    private readonly turnManager: TurnManager;

    private readonly foundCountries = new Set<string>();

    constructor(
        private readonly state: CountriesGameState,
        private readonly answerValidator: CountryNameValidator,
        private readonly totalCountries: number,
    ) {
        this.turnManager = new TurnManager();
    }

    addPlayer(sessionId: string, username: string): void {
        const existingPlayer = this.state.getPlayer(sessionId);

        if (!existingPlayer) {
            const player = new PlayerState(username);
            this.state.addPlayer(sessionId, player);
        }

        this.turnManager.addPlayer(sessionId);

        if (this.state.status === GameStatus.WAITING) {
            this.startGame();
        }
    }

    removePlayer(sessionId: string): void {
        this.state.removePlayer(sessionId);
        this.turnManager.removePlayer(sessionId);

        if (this.state.numberOfPlayers === 0) {
            this.resetGameTime();
            this.state.status = GameStatus.WAITING;
        }
    }

    submitAnswer(sessionId: string, answer: string): SubmitAnswerResult {
        const currentPlayerSessionId = this.turnManager.getCurrentPlayerId();

        if (this.state.status !== GameStatus.PLAYING) {
            return {
                accepted: false,
                playerSessionId: sessionId,
                reason: "GAME_NOT_PLAYING",
                currentPlayerSessionId,
                nextPlayerSessionId: currentPlayerSessionId,
            };
        }

        if (!this.turnManager.isCurrentPlayer(sessionId)) {
            return {
                accepted: false,
                playerSessionId: sessionId,
                reason: "NOT_YOUR_TURN",
                currentPlayerSessionId,
                nextPlayerSessionId: currentPlayerSessionId,
            };
        }

        if (!answer.trim()) {
            return {
                accepted: false,
                playerSessionId: sessionId,
                reason: "EMPTY_ANSWER",
                currentPlayerSessionId,
                nextPlayerSessionId: currentPlayerSessionId,
            };
        }

        const validation = this.validateAnswer(answer);

        if (!validation.valid) {
            const nextPlayerSessionId = this.turnManager.nextTurn();

            return {
                accepted: false,
                playerSessionId: sessionId,
                reason: "WRONG_ANSWER",
                currentPlayerSessionId,
                nextPlayerSessionId,
            };
        }

        if (this.hasCountryBeenFound(validation.countryId)) {
            const nextPlayerSessionId = this.turnManager.nextTurn();

            return {
                accepted: false,
                playerSessionId: sessionId,
                reason: "COUNTRY_ALREADY_FOUND",
                currentPlayerSessionId,
                nextPlayerSessionId,
            };
        }

        const pointsAwarded = 1;

        this.addPointToPlayer(sessionId, pointsAwarded);
        this.markCountryAsFound(validation.countryId);
        this.incrementContinentProgress(validation.continentId);

        if (this.foundCountries.size >= this.totalCountries) {
            this.state.status = GameStatus.FINISHED;
        }

        const nextPlayerSessionId =
            this.state.status === GameStatus.FINISHED
                ? this.turnManager.getCurrentPlayerId()
                : this.turnManager.nextTurn();

        return {
            accepted: true,
            playerSessionId: sessionId,
            countryCode: validation.countryId,
            continentCode: validation.continentId,
            canonicalName: validation.canonicalName,
            pointsAwarded,
            currentPlayerSessionId,
            nextPlayerSessionId,
        };
    }

    passTurn(sessionId: string): PassTurnResult {
        const currentPlayerSessionId = this.turnManager.getCurrentPlayerId();

        if (this.state.status !== GameStatus.PLAYING) {
            return {
                accepted: false,
                playerSessionId: sessionId,
                reason: "GAME_NOT_PLAYING",
                currentPlayerSessionId,
                nextPlayerSessionId: currentPlayerSessionId,
            };
        }

        if (!this.turnManager.isCurrentPlayer(sessionId)) {
            return {
                accepted: false,
                playerSessionId: sessionId,
                reason: "NOT_YOUR_TURN",
                currentPlayerSessionId,
                nextPlayerSessionId: currentPlayerSessionId,
            };
        }

        const nextPlayerSessionId = this.turnManager.nextTurn();

        return {
            accepted: true,
            playerSessionId: sessionId,
            currentPlayerSessionId,
            nextPlayerSessionId,
        };
    }

    pause(): void {
        if (this.state.status === GameStatus.PLAYING) {
            this.state.status = GameStatus.PAUSED;
        }
    }

    resume(): void {
        if (this.state.status === GameStatus.PAUSED) {
            this.state.status = GameStatus.PLAYING;
        }
    }

    finish(): void {
        this.state.status = GameStatus.FINISHED;
    }

    getCurrentPlayerSessionId(): string {
        return this.turnManager.getCurrentPlayerId();
    }

    private startGame(): void {
        this.state.status = GameStatus.PLAYING;
        this.state.startAt = Date.now();
        this.state.endAt = this.state.startAt + this.state.durationInSeconds * 1000;
    }

    private resetGameTime(): void {
        this.state.startAt = 0;
        this.state.endAt = 0;
    }

    private validateAnswer(answer: string): CountryValidationResult {
        return this.answerValidator.validate(answer);
    }

    private addPointToPlayer(sessionId: string, points: number): void {
        const player = this.state.getPlayer(sessionId);

        if (!player) {
            return;
        }

        player.addScore(points);
        player.incrementCountriesFound();
    }

    private markCountryAsFound(countryCode: string): void {
        this.foundCountries.add(countryCode);
    }

    private hasCountryBeenFound(countryCode: string): boolean {
        return this.foundCountries.has(countryCode);
    }

    private incrementContinentProgress(continentCode: string): void {
        const continent = this.state.continents.get(continentCode);

        if (!continent) {
            return;
        }

        continent.incrementNumberOfCountriesFound();
    }
}
