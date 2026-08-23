import { Room, Client, CloseCode } from "colyseus";

import { CountriesGameState, GameStatus } from "#rooms/schema/CountriesGameState.js";
import { CountriesGame } from "#game/CountriesGame.js";
import { GameRoomMessageType } from "#rooms/GameRoomMessageType.js";
import { CountryNameValidator } from "#game/CountryNameValidator.js";
import {
    GameRoomConstraints,
    isTurnDurationInSecondsAllowed,
    normalizeTurnDurationInSeconds,
} from "#game/GameRoomConstraints.js";

import countriesAnswerValidation from "#data/json/countries-answer-validation.json" with { type: "json" };
import { SupportedLanguage } from "#data/continents.js";
import { AnswerValidationRequest, SubmitAnswerResult } from "#game/types.js";

type JoinOptions = {
    username?: string;
};

type CreateOptions = {
    gameLanguage: SupportedLanguage;
    gameDurationInSeconds: number;
    turnDurationInSeconds?: number;
    maxPlayersAllowed: number;
};

type SubmitCountryMessage = {
    countryName: string;
    validationLanguage: SupportedLanguage;
};

type UpdateRoomSettingsMessage = {
    gameDurationInSeconds: number;
    turnDurationInSeconds: number;
    maxPlayersAllowed: number;
};

type VotedGameAction = "pause" | "resume" | "restart";

type VoteGameActionMessage = {
    requestId: string;
    accepted: boolean;
};

type CountryFoundSubmissionResult = Extract<SubmitAnswerResult, { accepted: true }>;

type GameActionVoteRequest = {
    id: string;
    action: VotedGameAction;
    requestedByPlayerSessionId: string;
    requestedByUsername: string;
    requiredVoterSessionIds: Set<string>;
    acceptedVoterSessionIds: Set<string>;
    timeout: NodeJS.Timeout;
};

const GAME_ACTION_VOTE_TIMEOUT_MS = 5000;

const votedGameActionMessages: Record<
    VotedGameAction,
    {
        requested: GameRoomMessageType;
        rejected: GameRoomMessageType;
    }
> = {
    pause: {
        requested: GameRoomMessageType.PAUSE_GAME_REQUESTED,
        rejected: GameRoomMessageType.PAUSE_GAME_REJECTED,
    },
    resume: {
        requested: GameRoomMessageType.RESUME_GAME_REQUESTED,
        rejected: GameRoomMessageType.RESUME_GAME_REJECTED,
    },
    restart: {
        requested: GameRoomMessageType.RESTART_GAME_REQUESTED,
        rejected: GameRoomMessageType.RESTART_GAME_REJECTED,
    },
};

export class CountriesGameRoom extends Room {
    maxClients = 8;
    state: CountriesGameState;

    private game!: CountriesGame;
    private gameEndTimeout: NodeJS.Timeout | null = null;
    private turnTimeout: NodeJS.Timeout | null = null;
    private currentTurnStartedAt: number = 0;
    private currentTurnDurationMilliseconds: number = 0;
    private remainingTurnMilliseconds: number | null = null;
    private readonly gameActionVoteRequests = new Map<string, GameActionVoteRequest>();

    onCreate(options: CreateOptions): void {
        const maxPlayersAllowed = options.maxPlayersAllowed ?? 8;

        this.state = new CountriesGameState(
            options.gameLanguage,
            options.gameDurationInSeconds,
            normalizeTurnDurationInSeconds(options.turnDurationInSeconds),
            maxPlayersAllowed,
        );

        this.maxClients = maxPlayersAllowed;

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

        this.onMessage(
            GameRoomMessageType.UPDATE_ROOM_SETTINGS,
            (client, message: UpdateRoomSettingsMessage) => {
                this.updateRoomSettings(client, message);
            },
        );

        this.onMessage(GameRoomMessageType.PAUSE_GAME, (client) => {
            this.requestVotedGameAction(client, "pause");
        });

        this.onMessage(GameRoomMessageType.RESUME_GAME, (client) => {
            this.requestVotedGameAction(client, "resume");
        });

        this.onMessage(GameRoomMessageType.RESTART_GAME, (client) => {
            this.requestVotedGameAction(client, "restart");
        });

        this.onMessage(
            GameRoomMessageType.VOTE_PAUSE_GAME,
            (client, message: VoteGameActionMessage) => {
                this.voteForGameAction(client, "pause", message);
            },
        );

        this.onMessage(
            GameRoomMessageType.VOTE_RESUME_GAME,
            (client, message: VoteGameActionMessage) => {
                this.voteForGameAction(client, "resume", message);
            },
        );

        this.onMessage(
            GameRoomMessageType.VOTE_RESTART_GAME,
            (client, message: VoteGameActionMessage) => {
                this.voteForGameAction(client, "restart", message);
            },
        );

        this.onMessage(GameRoomMessageType.END_GAME, (client) => {
            this.endGame(client);
        });
    }

    onAuth(): boolean {
        if (this.clients.length >= this.state.maxPlayersAllowed) {
            throw new Error("ROOM_FULL");
        }

        return true;
    }

    onJoin(client: Client, options: JoinOptions): void {
        const username = options.username || `Player-${client.sessionId.slice(0, 4)}`;

        if (!this.canJoinActivePlayers()) {
            this.state.addWaitingPlayer(client.sessionId, username, Date.now());
            return;
        }

        this.addActivePlayer(client, username);
    }

    private addActivePlayer(client: Client, username: string): void {
        this.game.addPlayer(client.sessionId, username);

        this.broadcast(GameRoomMessageType.PLAYER_JOIN_ROOM, {
            playerSessionId: client.sessionId,
            username,
            numberOfPlayers: this.state.numberOfPlayers,
            currentPlayerSessionId: this.game.getCurrentPlayerSessionId(),
        });
    }

    onLeave(client: Client, code: CloseCode): void {
        const waitingPlayer = this.state.getWaitingPlayer(client.sessionId);

        if (waitingPlayer) {
            this.state.removeWaitingPlayer(client.sessionId);
            return;
        }

        const player = this.state.getPlayer(client.sessionId);
        const username = player?.username ?? `Player-${client.sessionId.slice(0, 4)}`;
        const previousPlayerSessionId = this.game.getCurrentPlayerSessionId();

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

        this.updateGameActionVoteRequestsAfterPlayerLeft(client.sessionId);

        if (this.state.status === GameStatus.WAITING) {
            this.promoteWaitingPlayersToRoom();
        }

        if (this.state.status === GameStatus.PLAYING) {
            this.broadcastTurnChangedIfNeeded(previousPlayerSessionId);
        }
    }

    onDispose(): void {
        this.clearGameEndTimeout();
        this.clearTurnTimeout();
        this.clearGameActionVoteRequests();

        console.log("room", this.roomId, "disposing...");
    }

    private canJoinActivePlayers(): boolean {
        return this.state.status === GameStatus.WAITING;
    }

    private promoteWaitingPlayersToRoom(): void {
        while (
            this.state.waitingPlayers.length > 0 &&
            this.state.numberOfPlayers < this.state.maxPlayersAllowed
        ) {
            const waitingPlayer = this.state.shiftWaitingPlayer();

            if (!waitingPlayer) {
                return;
            }

            const client = this.clients.find(
                (roomClient) => roomClient.sessionId === waitingPlayer.id,
            );

            if (!client) {
                continue;
            }

            this.addActivePlayer(client, waitingPlayer.username);
        }
    }

    private startGame(client: Client): void {
        this.promoteWaitingPlayersToRoom();

        const result = this.game.start();

        if (!result.accepted) {
            client.send(GameRoomMessageType.START_GAME_REJECTED, result);
            return;
        }

        this.scheduleGameEnd();
        this.scheduleTurnTimeout();

        this.broadcast(GameRoomMessageType.GAME_STARTED, {
            startAt: result.startAt,
            endAt: result.endAt,
            durationInSeconds: this.state.durationInSeconds,
            currentPlayerSessionId: result.currentPlayerSessionId,
            startedBy: client.sessionId,
        });
        this.broadcastTurnChanged();
    }

    private applyPauseGame(pausedBy: string, rejectionRecipient?: Client): void {
        const result = this.game.pause();

        if (!result.accepted) {
            rejectionRecipient?.send(GameRoomMessageType.PAUSE_GAME_REJECTED, result);
            return;
        }

        this.clearGameEndTimeout();
        this.pauseTurnTimeout();

        this.broadcast(GameRoomMessageType.GAME_PAUSED, {
            pausedAt: result.pausedAt,
            pausedBy,
        });
    }

    private applyResumeGame(resumedBy: string, rejectionRecipient?: Client): void {
        const result = this.game.resume();

        if (!result.accepted) {
            rejectionRecipient?.send(GameRoomMessageType.RESUME_GAME_REJECTED, result);
            return;
        }

        this.scheduleGameEnd();
        this.resumeTurnTimeout();
        this.broadcastTurnChanged();

        this.broadcast(GameRoomMessageType.GAME_RESUMED, {
            resumedAt: result.resumedAt,
            endAt: result.endAt,
            resumedBy,
        });
    }

    private applyRestartGame(restartedBy: string, rejectionRecipient?: Client): void {
        const result = this.game.restart();

        if (!result.accepted) {
            rejectionRecipient?.send(GameRoomMessageType.RESTART_GAME_REJECTED, result);
            return;
        }

        this.clearGameEndTimeout();
        this.clearTurnTimeout();
        this.clearGameActionVoteRequests();

        this.broadcast(GameRoomMessageType.GAME_RESTARTED, {
            restartedAt: result.restartedAt,
            currentPlayerSessionId: result.currentPlayerSessionId,
            restartedBy,
        });
        this.promoteWaitingPlayersToRoom();
    }

    private endGame(client: Client): void {
        this.finishGame("MANUAL_END", client.sessionId);
    }

    private handleCountrySubmission(client: Client, message: SubmitCountryMessage): void {
        const previousPlayerSessionId = this.game.getCurrentPlayerSessionId();
        const answer = {
            answer: message.countryName,
            language: message.validationLanguage,
        } as AnswerValidationRequest;
        const result = this.game.submitAnswer(client.sessionId, answer);

        client.send(GameRoomMessageType.SUBMIT_COUNTRY_NAME_RESULT, result);

        this.broadcast(GameRoomMessageType.COUNTRY_SUBMITTED, {
            result,
            currentPlayerSessionId: this.game.getCurrentPlayerSessionId(),
        });
        this.broadcastCountryFoundIfAccepted(result);

        if (this.state.status === GameStatus.FINISHED) {
            this.finishGame("ALL_COUNTRIES_FOUND");
            return;
        }

        this.broadcastTurnChangedIfNeeded(
            previousPlayerSessionId,
            this.isTurnConsumingCountrySubmissionResult(result),
        );
    }

    private updateRoomSettings(client: Client, message: UpdateRoomSettingsMessage): void {
        if (!isTurnDurationInSecondsAllowed(message.turnDurationInSeconds)) {
            client.send(GameRoomMessageType.UPDATE_ROOM_SETTINGS_REJECTED, {
                accepted: false,
                reason: "TURN_DURATION_OUT_OF_RANGE",
                minTurnDurationInSeconds: GameRoomConstraints.TURN_DURATION_IN_SECONDS.min,
                maxTurnDurationInSeconds: GameRoomConstraints.TURN_DURATION_IN_SECONDS.max,
            });
            return;
        }

        const nextSettings = {
            maxPlayersAllowed:
                this.state.status === GameStatus.WAITING
                    ? message.maxPlayersAllowed
                    : this.maxClients,
            gameDurationInSeconds:
                this.state.status === GameStatus.WAITING
                    ? message.gameDurationInSeconds
                    : this.state.durationInSeconds,
            turnDurationInSeconds: message.turnDurationInSeconds,
        };

        this.maxClients = nextSettings.maxPlayersAllowed;
        this.state.updateRoomSettings(nextSettings);

        if (this.state.status === GameStatus.WAITING) {
            this.promoteWaitingPlayersToRoom();
        }

        if (this.state.status === GameStatus.PLAYING) {
            this.scheduleTurnTimeout();
            this.broadcastTurnChanged();
        }

        this.broadcast(GameRoomMessageType.ROOM_SETTINGS_UPDATED, {
            accepted: true,
            ...nextSettings,
        });
    }

    private handlePassTurn(client: Client): void {
        const previousPlayerSessionId = this.game.getCurrentPlayerSessionId();
        const result = this.game.passTurn(client.sessionId);

        client.send(GameRoomMessageType.PASS_TURN_RESULT, result);

        this.broadcast(GameRoomMessageType.TURN_PASSED, {
            result,
            currentPlayerSessionId: this.game.getCurrentPlayerSessionId(),
        });

        if (this.isTimeExpiredResult(result)) {
            this.finishGame("TIME_EXPIRED");
            return;
        }

        this.broadcastTurnChangedIfNeeded(previousPlayerSessionId, this.isAcceptedResult(result));
    }

    private handleTurnTimeout(): void {
        if (this.state.status !== GameStatus.PLAYING) {
            return;
        }

        const previousPlayerSessionId = this.game.getCurrentPlayerSessionId();
        const result = this.game.passTurn(previousPlayerSessionId);

        this.broadcast(GameRoomMessageType.TURN_PASSED, {
            result,
            currentPlayerSessionId: this.game.getCurrentPlayerSessionId(),
            reason: "TURN_TIMEOUT",
        });

        if (this.isTimeExpiredResult(result)) {
            this.finishGame("TIME_EXPIRED");
            return;
        }

        this.broadcastTurnChangedIfNeeded(previousPlayerSessionId, true);
    }

    private scheduleGameEnd(): void {
        this.clearGameEndTimeout();

        const remainingMilliseconds = Math.max(0, this.state.endAt - Date.now());

        this.gameEndTimeout = setTimeout(() => {
            this.finishGame("TIME_EXPIRED");
        }, remainingMilliseconds);
    }

    private scheduleTurnTimeout(durationInMilliseconds?: number): void {
        this.clearTurnTimeout();

        if (this.state.status !== GameStatus.PLAYING) {
            return;
        }

        const turnDurationInMilliseconds =
            durationInMilliseconds ?? this.state.turnDurationInSeconds * 1000;

        this.currentTurnStartedAt = Date.now();
        this.currentTurnDurationMilliseconds = turnDurationInMilliseconds;
        this.remainingTurnMilliseconds = null;
        this.turnTimeout = setTimeout(() => {
            this.handleTurnTimeout();
        }, turnDurationInMilliseconds);
    }

    private pauseTurnTimeout(): void {
        if (!this.turnTimeout) {
            return;
        }

        const elapsedMilliseconds = Date.now() - this.currentTurnStartedAt;
        this.remainingTurnMilliseconds = Math.max(
            0,
            this.currentTurnDurationMilliseconds - elapsedMilliseconds,
        );
        this.clearTurnTimeout();
    }

    private resumeTurnTimeout(): void {
        this.scheduleTurnTimeout(this.remainingTurnMilliseconds ?? undefined);
    }

    private broadcastTurnChangedIfNeeded(
        previousPlayerSessionId: string,
        forceTurnRefresh: boolean = false,
    ): void {
        const currentPlayerSessionId = this.game.getCurrentPlayerSessionId();

        if (
            this.state.status !== GameStatus.PLAYING ||
            (!forceTurnRefresh && currentPlayerSessionId === previousPlayerSessionId)
        ) {
            return;
        }

        this.scheduleTurnTimeout();
        this.broadcastTurnChanged();
    }

    private broadcastTurnChanged(): void {
        const currentPlayerSessionId = this.game.getCurrentPlayerSessionId();
        const player = this.state.getPlayer(currentPlayerSessionId);

        if (!player) {
            return;
        }

        this.broadcast(GameRoomMessageType.TURN_CHANGED, {
            player,
            currentPlayerSessionId,
            turnDurationInSeconds: Math.ceil(this.currentTurnDurationMilliseconds / 1000),
            turnStartedAt: this.currentTurnStartedAt,
        });
    }

    private isTurnConsumingCountrySubmissionResult(result: unknown): boolean {
        const submissionResult = result as {
            accepted?: boolean;
            reason?: string;
        };

        return (
            submissionResult.accepted === true ||
            submissionResult.reason === "WRONG_ANSWER" ||
            submissionResult.reason === "COUNTRY_ALREADY_FOUND"
        );
    }

    private broadcastCountryFoundIfAccepted(result: unknown): void {
        if (!this.isCountryFoundSubmissionResult(result)) {
            return;
        }

        const player = this.state.getPlayer(result.playerSessionId);

        if (!player) {
            return;
        }

        this.broadcast(GameRoomMessageType.COUNTRY_FOUND, {
            countryId: result.countryId,
            player,
            pointsAwarded: result.pointsAwarded,
        });
    }

    private isCountryFoundSubmissionResult(result: unknown): result is CountryFoundSubmissionResult {
        const submissionResult = result as Partial<CountryFoundSubmissionResult> | null;

        return (
            submissionResult?.accepted === true &&
            typeof submissionResult.countryId === "string" &&
            typeof submissionResult.playerSessionId === "string" &&
            typeof submissionResult.pointsAwarded === "number"
        );
    }

    private isAcceptedResult(result: unknown): boolean {
        return (result as { accepted?: boolean }).accepted === true;
    }

    private isTimeExpiredResult(result: unknown): boolean {
        return (result as { reason?: string }).reason === "TIME_EXPIRED";
    }

    private finishGame(
        reason: "TIME_EXPIRED" | "MANUAL_END" | "ALL_COUNTRIES_FOUND",
        endedBy?: string,
    ): void {
        this.clearGameEndTimeout();
        this.clearTurnTimeout();
        this.clearGameActionVoteRequests();

        this.game.finish();

        this.broadcast(GameRoomMessageType.GAME_FINISHED, {
            reason,
            endedBy,
            finishedAt: Date.now(),
        });
    }

    private requestVotedGameAction(client: Client, action: VotedGameAction): void {
        const requestFailureReason = this.getVotedGameActionRequestFailureReason(action);

        if (requestFailureReason) {
            client.send(votedGameActionMessages[action].rejected, {
                accepted: false,
                reason: requestFailureReason,
            });
            return;
        }

        if (this.hasPendingGameActionVoteRequest()) {
            client.send(votedGameActionMessages[action].rejected, {
                accepted: false,
                reason: "REQUEST_ALREADY_PENDING",
            });
            return;
        }

        const requiredVoterSessionIds = this.clients
            .map((roomClient) => roomClient.sessionId)
            .filter((sessionId) => sessionId !== client.sessionId);

        if (requiredVoterSessionIds.length === 0) {
            this.executeVotedGameAction(action, client.sessionId, client);
            return;
        }

        const player = this.state.getPlayer(client.sessionId);
        const requestId = this.createGameActionVoteRequestId(action);
        const timeout = setTimeout(() => {
            this.rejectGameActionVoteRequest(requestId, "VOTE_TIMEOUT");
        }, GAME_ACTION_VOTE_TIMEOUT_MS);

        const request: GameActionVoteRequest = {
            id: requestId,
            action,
            requestedByPlayerSessionId: client.sessionId,
            requestedByUsername: player?.username ?? `Player-${client.sessionId.slice(0, 4)}`,
            requiredVoterSessionIds: new Set(requiredVoterSessionIds),
            acceptedVoterSessionIds: new Set(),
            timeout,
        };

        this.gameActionVoteRequests.set(request.id, request);

        this.broadcast(votedGameActionMessages[action].requested, {
            requestId: request.id,
            requestedByPlayerSessionId: request.requestedByPlayerSessionId,
            requestedByUsername: request.requestedByUsername,
            requiredVoterSessionIds,
        });
    }

    private voteForGameAction(
        client: Client,
        action: VotedGameAction,
        message: VoteGameActionMessage,
    ): void {
        const request = this.gameActionVoteRequests.get(message.requestId);

        if (!request || request.action !== action) {
            client.send(votedGameActionMessages[action].rejected, {
                accepted: false,
                reason: "REQUEST_NOT_FOUND",
                requestId: message.requestId,
            });
            return;
        }

        if (!request.requiredVoterSessionIds.has(client.sessionId)) {
            client.send(votedGameActionMessages[action].rejected, {
                accepted: false,
                reason: "PLAYER_NOT_ALLOWED_TO_VOTE",
                requestId: message.requestId,
            });
            return;
        }

        if (!message.accepted) {
            this.rejectGameActionVoteRequest(request.id, "VOTE_DECLINED", client.sessionId);
            return;
        }

        request.acceptedVoterSessionIds.add(client.sessionId);

        if (this.hasEnoughApprovals(request)) {
            this.resolveGameActionVoteRequest(request);
        }
    }

    private updateGameActionVoteRequestsAfterPlayerLeft(playerSessionId: string): void {
        Array.from(this.gameActionVoteRequests.values()).forEach((request) => {
            if (request.requestedByPlayerSessionId === playerSessionId) {
                this.rejectGameActionVoteRequest(request.id, "REQUESTER_LEFT", playerSessionId);
                return;
            }

            request.requiredVoterSessionIds.delete(playerSessionId);
            request.acceptedVoterSessionIds.delete(playerSessionId);

            if (this.hasEnoughApprovals(request)) {
                this.resolveGameActionVoteRequest(request);
            }
        });
    }

    private resolveGameActionVoteRequest(request: GameActionVoteRequest): void {
        this.removeGameActionVoteRequest(request.id);
        this.executeVotedGameAction(request.action, request.requestedByPlayerSessionId);
    }

    private rejectGameActionVoteRequest(
        requestId: string,
        reason: string,
        rejectedBy?: string,
    ): void {
        const request = this.gameActionVoteRequests.get(requestId);

        if (!request) {
            return;
        }

        this.removeGameActionVoteRequest(requestId);

        this.broadcast(votedGameActionMessages[request.action].rejected, {
            accepted: false,
            reason,
            requestId,
            rejectedBy,
        });
    }

    private executeVotedGameAction(
        action: VotedGameAction,
        requestedByPlayerSessionId: string,
        rejectionRecipient?: Client,
    ): void {
        if (action === "pause") {
            this.applyPauseGame(requestedByPlayerSessionId, rejectionRecipient);
            return;
        }

        if (action === "resume") {
            this.applyResumeGame(requestedByPlayerSessionId, rejectionRecipient);
            return;
        }

        this.applyRestartGame(requestedByPlayerSessionId, rejectionRecipient);
    }

    private getVotedGameActionRequestFailureReason(action: VotedGameAction): string | null {
        if (action === "pause" && this.state.status !== GameStatus.PLAYING) {
            return "GAME_NOT_PLAYING";
        }

        if (action === "resume" && this.state.status !== GameStatus.PAUSED) {
            return "GAME_NOT_PAUSED";
        }

        if (action === "restart") {
            if (this.state.numberOfPlayers === 0) {
                return "NO_PLAYERS";
            }

            if (this.state.status === GameStatus.WAITING) {
                return "GAME_NOT_STARTED";
            }
        }

        return null;
    }

    private hasPendingGameActionVoteRequest(): boolean {
        return this.gameActionVoteRequests.size > 0;
    }

    private hasEnoughApprovals(request: GameActionVoteRequest): boolean {
        return request.acceptedVoterSessionIds.size >= request.requiredVoterSessionIds.size;
    }

    private createGameActionVoteRequestId(action: VotedGameAction): string {
        return `${action}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    private removeGameActionVoteRequest(requestId: string): void {
        const request = this.gameActionVoteRequests.get(requestId);

        if (!request) {
            return;
        }

        clearTimeout(request.timeout);
        this.gameActionVoteRequests.delete(requestId);
    }

    private clearGameActionVoteRequests(): void {
        this.gameActionVoteRequests.forEach((request) => {
            clearTimeout(request.timeout);
        });
        this.gameActionVoteRequests.clear();
    }

    private clearGameEndTimeout(): void {
        if (!this.gameEndTimeout) {
            return;
        }

        clearTimeout(this.gameEndTimeout);
        this.gameEndTimeout = null;
    }

    private clearTurnTimeout(): void {
        if (!this.turnTimeout) {
            return;
        }

        clearTimeout(this.turnTimeout);
        this.turnTimeout = null;
    }
}
