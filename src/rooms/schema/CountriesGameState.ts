import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";
import { ContinentProgressState } from "./ContinentProgressState.js";

export enum GameStatus {
    WAITING = "waiting",
    PLAYING = "playing",
    PAUSED = "paused",
    FINISHED = "finished",
}

export class CountriesGameState extends Schema {
    @type("number")
    numberOfPlayers: number = 0;

    @type("string")
    language: string;

    @type("number")
    durationInSeconds: number = 0;

    @type("number")
    startAt: number = 0;

    @type("number")
    endAt: number = 0;

    @type("string")
    status: GameStatus = GameStatus.WAITING;

    @type({ map: PlayerState })
    players = new MapSchema<PlayerState>();

    @type({ map: ContinentProgressState })
    continents = new MapSchema<ContinentProgressState>();

    constructor(gameLanguage: string, gameDuration: number) {
        super();
        this.language = gameLanguage;
        this.durationInSeconds = gameDuration;
    }

    getPlayer(playerSessionId: string) {
        return this.players.get(playerSessionId);
    }

    addPlayer(playerSessionId: string, player: PlayerState) {
        this.players.set(playerSessionId, player);
        this.numberOfPlayers = this.players.size;
    }

    removePlayer(playerSessionId: string) {
        this.players.delete(playerSessionId);
        this.numberOfPlayers = this.players.size;
    }
}
