import { Schema, type } from "@colyseus/schema";

export class WaitingPlayerState extends Schema {
    @type("string")
    id: string;

    @type("string")
    username: string;

    @type("number")
    joinedAt: number;

    constructor(id: string, username: string, joinedAt: number) {
        super();
        this.id = id;
        this.username = username;
        this.joinedAt = joinedAt;
    }
}
