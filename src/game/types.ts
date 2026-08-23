import { SupportedLanguage } from "#data/continents.js";

export type StartGameResult =
    | {
          accepted: true;
          startAt: number;
          endAt: number;
          currentPlayerSessionId: string;
      }
    | {
          accepted: false;
          reason: "GAME_ALREADY_STARTED" | "NO_PLAYERS";
      };

export type PauseGameResult =
    | {
          accepted: true;
          pausedAt: number;
      }
    | {
          accepted: false;
          reason: "GAME_NOT_PLAYING";
      };

export type ResumeGameResult =
    | {
          accepted: true;
          resumedAt: number;
          endAt: number;
      }
    | {
          accepted: false;
          reason: "GAME_NOT_PAUSED";
      };

export type RestartGameResult =
    | {
          accepted: true;
          restartedAt: number;
          currentPlayerSessionId: string;
      }
    | {
          accepted: false;
          reason: "GAME_NOT_STARTED" | "NO_PLAYERS";
      };

type SubmitAnswerFailureReason =
    | "GAME_NOT_PLAYING"
    | "TIME_EXPIRED"
    | "NOT_YOUR_TURN"
    | "EMPTY_ANSWER"
    | "WRONG_ANSWER"
    | "COUNTRY_ALREADY_FOUND";

export type SubmitAnswerResult =
    | {
          accepted: true;
          playerSessionId: string;
          countryId: string;
          continentId: string;
          canonicalName: string;
          pointsAwarded: number;
          currentPlayerSessionId: string;
          nextPlayerSessionId: string;
      }
    | {
          accepted: false;
          playerSessionId: string;
          reason: SubmitAnswerFailureReason;
          currentPlayerSessionId: string;
          nextPlayerSessionId: string;
      };

type PassTurnFailureReason = "GAME_NOT_PLAYING" | "TIME_EXPIRED" | "NOT_YOUR_TURN";

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
          reason: PassTurnFailureReason;
          currentPlayerSessionId: string;
          nextPlayerSessionId: string;
      };

export type AnswerValidationRequest = {
    answer: string;
    language: SupportedLanguage;
};
