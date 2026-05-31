import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
    @type("string")
    id: string;

    @type("string")
    username: string;

    @type("number")
    score: number = 0;

    @type("number")
    totalCountriesFound: number = 0;

    constructor(id: string, username: string) {
        super();
        this.id = id;
        this.username = username;
    }

    addScore(points: number) {
        this.score += points;
    }

    incrementCountriesFound() {
        this.totalCountriesFound++;
    }
}
