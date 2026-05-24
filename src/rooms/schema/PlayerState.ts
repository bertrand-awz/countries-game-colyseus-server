import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
    @type("string")
    playerUsername: string;
    @type("number")
    score: number = 0;
    @type("number")
    totalCountriesFound: number = 0;

    constructor(playerUsername: string) {
        super();
        this.playerUsername = playerUsername;
    }

    addScore(points: number) {
        this.score += points;
    }

    incrementCountriesFound() {
        this.totalCountriesFound++;
    }
}
