import { Schema, type } from "@colyseus/schema";

export class ContinentProgressState extends Schema {
    @type("string")
    name: string;
    @type("number")
    totalCountriesFound: number = 0;
    @type("number")
    numberOfCountries: number = 0;

    constructor(continentName: string, numberOfCountries: number) {
        super();
        this.name = continentName;
        this.numberOfCountries = numberOfCountries;
    }

    incrementNumberOfCountriesFound() {
        this.totalCountriesFound++;
    }
}
