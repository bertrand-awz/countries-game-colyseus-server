import { ArraySchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";
import { ContinentProgressState } from "./ContinentProgressState.js";
import { SupportedLanguage } from "#game/CountryNameValidator.js";
import { continentsDetails } from "#data/continents.js";

export enum GameStatus {
    WAITING = "waiting",
    PLAYING = "playing",
    PAUSED = "paused",
    FINISHED = "finished",
}

export class CountriesGameState extends Schema {
    @type("number")
    numberOfPlayers: number = 0;

    @type("number")
    durationInSeconds: number = 0;

    @type("number")
    startAt: number = 0;

    @type("number")
    endAt: number = 0;

    @type("string")
    status: GameStatus = GameStatus.WAITING;

    @type("boolean")
    allowAnswerValidationInPlayerCurrentLanguage: boolean = true;

    @type("string")
    defaultLanguage: SupportedLanguage;

    @type([PlayerState])
    players = new ArraySchema<PlayerState>();

    @type([ContinentProgressState])
    continents = new ArraySchema<ContinentProgressState>();

    constructor(defaultLanguage: SupportedLanguage, gameDuration: number) {
        super();
        this.defaultLanguage = defaultLanguage;
        this.durationInSeconds = gameDuration;
        this.continents.push(
            ...continentsDetails.map(
                (continent) =>
                    new ContinentProgressState(continent.code, continent.numberOfCountries),
            ),
        );
    }

    getPlayer(playerSessionId: string) {
        return this.players.find((player) => player.id === playerSessionId);
    }

    addPlayer(playerSessionId: string, player: PlayerState) {
        const existingPlayer = this.getPlayer(playerSessionId);

        if (existingPlayer) {
            return;
        }

        this.players.push(player);
        this.numberOfPlayers = this.players.length;
    }

    removePlayer(playerSessionId: string) {
        const playerIndex = this.players.findIndex((player) => player.id === playerSessionId);

        if (playerIndex >= 0) {
            this.players.splice(playerIndex, 1);
        }

        this.numberOfPlayers = this.players.length;
    }

    getContinentProgress(continentId: string) {
        return this.continents.find((progress) => progress.continent.id === continentId);
    }
}
