import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
    @type("string")
    username: string;

    @type("number")
    score: number = 0;

    @type("number")
    totalCountriesFound: number = 0;

    constructor(username: string) {
        super();
        this.username = username;
    }

    addScore(points: number) {
        this.score += points;
    }

    incrementCountriesFound() {
        this.totalCountriesFound++;
    }
}
