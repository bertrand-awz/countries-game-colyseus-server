import { TurnManager } from "./TurnManager.js";
import { CountriesGameState, GameStatus } from "#rooms/schema/CountriesGameState.js";
import { PlayerState } from "#rooms/schema/PlayerState.js";
import {
    CountryNameValidator,
    type CountryValidationResult,
    SupportedLanguage,
} from "./CountryNameValidator.js";
import {
    AnswerValidationRequest,
    PassTurnResult,
    PauseGameResult,
    RestartGameResult,
    ResumeGameResult,
    StartGameResult,
    SubmitAnswerResult,
} from "#game/types.js";

class SubmitAnswerFailureReason {}

class PassTurnFailureReason {}

export class CountriesGame {
    private readonly turnManager: TurnManager;
    private readonly foundCountries = new Set<string>();

    private pausedAt: number | null = null;

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
            const player = new PlayerState(sessionId, username);
            this.state.addPlayer(sessionId, player);
        }

        this.turnManager.addPlayer(sessionId);
    }

    removePlayer(sessionId: string): void {
        this.state.removePlayer(sessionId);
        this.turnManager.removePlayer(sessionId);

        if (this.state.numberOfPlayers === 0) {
            this.resetGame();
        }
    }

    start(): StartGameResult {
        if (this.state.status !== GameStatus.WAITING) {
            return {
                accepted: false,
                reason: "GAME_ALREADY_STARTED",
            };
        }

        if (this.state.numberOfPlayers === 0) {
            return {
                accepted: false,
                reason: "NO_PLAYERS",
            };
        }

        this.state.status = GameStatus.PLAYING;
        this.state.startAt = Date.now();
        this.state.endAt = this.state.startAt + this.state.durationInSeconds * 1000;

        return {
            accepted: true,
            startAt: this.state.startAt,
            endAt: this.state.endAt,
            currentPlayerSessionId: this.getCurrentPlayerSessionId(),
        };
    }

    pause(): PauseGameResult {
        if (this.state.status !== GameStatus.PLAYING) {
            return {
                accepted: false,
                reason: "GAME_NOT_PLAYING",
            };
        }

        this.pausedAt = Date.now();
        this.state.status = GameStatus.PAUSED;

        return {
            accepted: true,
            pausedAt: this.pausedAt,
        };
    }

    resume(): ResumeGameResult {
        if (this.state.status !== GameStatus.PAUSED || this.pausedAt === null) {
            return {
                accepted: false,
                reason: "GAME_NOT_PAUSED",
            };
        }

        const resumedAt = Date.now();
        const pauseDurationInMilliseconds = resumedAt - this.pausedAt;

        this.state.endAt += pauseDurationInMilliseconds;
        this.state.status = GameStatus.PLAYING;
        this.pausedAt = null;

        return {
            accepted: true,
            resumedAt,
            endAt: this.state.endAt,
        };
    }

    restart(): RestartGameResult {
        if (this.state.numberOfPlayers === 0) {
            return {
                accepted: false,
                reason: "NO_PLAYERS",
            };
        }

        if (this.state.status === GameStatus.WAITING) {
            return {
                accepted: false,
                reason: "GAME_NOT_STARTED",
            };
        }

        const restartedAt = Date.now();

        this.resetGame();

        return {
            accepted: true,
            restartedAt,
            currentPlayerSessionId: this.getCurrentPlayerSessionId(),
        };
    }

    finish(): void {
        if (this.state.status === GameStatus.FINISHED) {
            return;
        }

        this.state.status = GameStatus.FINISHED;
    }

    submitAnswer(
        sessionId: string,
        answerValidationRequest: AnswerValidationRequest,
    ): SubmitAnswerResult | SubmitAnswerFailureReason {
        const currentPlayerSessionId = this.turnManager.getCurrentPlayerId();

        if (this.state.status !== GameStatus.PLAYING) {
            return this.createSubmitAnswerFailureResult(
                sessionId,
                "GAME_NOT_PLAYING",
                currentPlayerSessionId,
            );
        }

        if (this.isTimeExpired()) {
            this.finish();

            return this.createSubmitAnswerFailureResult(
                sessionId,
                "TIME_EXPIRED",
                currentPlayerSessionId,
            );
        }

        if (!this.turnManager.isCurrentPlayer(sessionId)) {
            return this.createSubmitAnswerFailureResult(
                sessionId,
                "NOT_YOUR_TURN",
                currentPlayerSessionId,
            );
        }

        if (!answerValidationRequest.answer.trim()) {
            return this.createSubmitAnswerFailureResult(
                sessionId,
                "EMPTY_ANSWER",
                currentPlayerSessionId,
            );
        }

        const validation = this.validateAnswer(
            answerValidationRequest.answer,
            answerValidationRequest.language,
        );

        if (!validation.valid) {
            const nextPlayerSessionId = this.turnManager.nextTurn();

            return this.createSubmitAnswerFailureResult(
                sessionId,
                "WRONG_ANSWER",
                currentPlayerSessionId,
                nextPlayerSessionId,
            );
        }

        if (this.hasCountryBeenFound(validation.countryId)) {
            const nextPlayerSessionId = this.turnManager.nextTurn();

            return this.createSubmitAnswerFailureResult(
                sessionId,
                "COUNTRY_ALREADY_FOUND",
                currentPlayerSessionId,
                nextPlayerSessionId,
            );
        }

        const pointsAwarded = 1;

        this.addPointToPlayer(sessionId, pointsAwarded);
        this.markCountryAsFound(validation.countryId);
        this.incrementContinentProgress(validation.continentId);

        const isGameFinished = this.foundCountries.size >= this.totalCountries;

        if (isGameFinished) {
            this.finish();
        }

        const nextPlayerSessionId = isGameFinished
            ? this.turnManager.getCurrentPlayerId()
            : this.turnManager.nextTurn();

        return {
            accepted: true,
            playerSessionId: sessionId,
            countryId: validation.countryId,
            continentId: validation.continentId,
            canonicalName: validation.canonicalName,
            pointsAwarded,
            currentPlayerSessionId,
            nextPlayerSessionId,
        };
    }

    passTurn(sessionId: string): PassTurnResult | PassTurnFailureReason {
        const currentPlayerSessionId = this.turnManager.getCurrentPlayerId();

        if (this.state.status !== GameStatus.PLAYING) {
            return this.createPassTurnFailureResult(
                sessionId,
                "GAME_NOT_PLAYING",
                currentPlayerSessionId,
            );
        }

        if (this.isTimeExpired()) {
            this.finish();

            return this.createPassTurnFailureResult(
                sessionId,
                "TIME_EXPIRED",
                currentPlayerSessionId,
            );
        }

        if (!this.turnManager.isCurrentPlayer(sessionId)) {
            return this.createPassTurnFailureResult(
                sessionId,
                "NOT_YOUR_TURN",
                currentPlayerSessionId,
            );
        }

        const nextPlayerSessionId = this.turnManager.nextTurn();

        return {
            accepted: true,
            playerSessionId: sessionId,
            currentPlayerSessionId,
            nextPlayerSessionId,
        };
    }

    getCurrentPlayerSessionId(): string {
        return this.turnManager.getCurrentPlayerId();
    }

    private createSubmitAnswerFailureResult(
        sessionId: string,
        reason: SubmitAnswerFailureReason,
        currentPlayerSessionId: string,
        nextPlayerSessionId: string = currentPlayerSessionId,
    ): SubmitAnswerFailureReason {
        return {
            accepted: false,
            playerSessionId: sessionId,
            reason,
            currentPlayerSessionId,
            nextPlayerSessionId,
        };
    }

    private createPassTurnFailureResult(
        sessionId: string,
        reason: PassTurnFailureReason,
        currentPlayerSessionId: string,
        nextPlayerSessionId: string = currentPlayerSessionId,
    ): PassTurnFailureReason {
        return {
            accepted: false,
            playerSessionId: sessionId,
            reason,
            currentPlayerSessionId,
            nextPlayerSessionId,
        };
    }

    private isTimeExpired(): boolean {
        return Date.now() >= this.state.endAt;
    }
    private resetGame(): void {
        this.state.status = GameStatus.WAITING;
        this.state.startAt = 0;
        this.state.endAt = 0;
        this.pausedAt = null;
        this.foundCountries.clear();
        this.turnManager.resetTurn();
        this.state.players.forEach((player) => {
            player.resetProgress();
        });
        this.state.continents.forEach((continent) => {
            continent.reset();
        });
    }

    private validateAnswer(answer: string, language: SupportedLanguage): CountryValidationResult {
        const validationLanguage = this.state.allowAnswerValidationInPlayerCurrentLanguage
            ? language
            : this.state.defaultLanguage;
        return this.answerValidator.validate(answer, validationLanguage);
    }

    private addPointToPlayer(sessionId: string, points: number): void {
        const player = this.state.getPlayer(sessionId);

        if (!player) {
            return;
        }

        player.addScore(points);
        player.incrementCountriesFound();
    }

    private markCountryAsFound(countryId: string): void {
        this.foundCountries.add(countryId);
    }

    private hasCountryBeenFound(countryId: string): boolean {
        return this.foundCountries.has(countryId);
    }

    private incrementContinentProgress(continentId: string): void {
        const continent = this.state.getContinentProgress(continentId);

        if (!continent) {
            return;
        }

        continent.incrementNumberOfCountriesFound();
    }
}
