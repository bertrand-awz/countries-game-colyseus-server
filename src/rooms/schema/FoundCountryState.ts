import { Schema, type } from "@colyseus/schema";

export class FoundCountryState extends Schema {
    @type("string")
    countryId: string;

    @type("string")
    foundByPlayerId: string;

    @type("number")
    playerColorSlot: number;

    constructor(countryId: string, foundByPlayerId: string, playerColorSlot: number) {
        super();
        this.countryId = countryId;
        this.foundByPlayerId = foundByPlayerId;
        this.playerColorSlot = playerColorSlot;
    }
}
