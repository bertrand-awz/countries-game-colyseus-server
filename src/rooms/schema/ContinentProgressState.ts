import { Schema, type } from "@colyseus/schema";
import type { ContinentCode } from "#data/continents.js";

export class ContinentState extends Schema {
    @type("string")
    id: ContinentCode;

    @type("number")
    countriesNumber: number = 0;

    constructor(id: ContinentCode, countriesNumber: number) {
        super();
        this.id = id;
        this.countriesNumber = countriesNumber;
    }
}

export class ContinentProgressState extends Schema {
    @type(ContinentState)
    continent: ContinentState;

    @type("number")
    countriesFoundNumber: number = 0;

    constructor(continentId: ContinentCode, countriesNumber: number) {
        super();
        this.continent = new ContinentState(continentId, countriesNumber);
    }

    incrementNumberOfCountriesFound() {
        this.countriesFoundNumber++;
    }
}
