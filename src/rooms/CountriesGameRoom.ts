import { Room, Client, CloseCode } from "colyseus";
import {CountriesGameState} from "./schema/CountriesGameState.js";
import {PlayerState} from "./schema/PlayerState.js";

type JoinOptions = {
    username?:string;
};

type CreateOptions = {
    gameLanguage: string;
    gameDurationInSeconds: number;
    maxPlayersAllowed: number;
}

type SubmitCountryMessage = {
    countryName:string;
};



export class CountriesGameRoom extends Room {
    state: CountriesGameState;
    maxClients: number = 8;

    onCreate (options: CreateOptions) {
        this.state = new CountriesGameState(options.gameLanguage, options.gameDurationInSeconds);
        this.maxClients = options.maxPlayersAllowed;
        this.onMessage("submit-country", (client, message) => {
            this.handleCountrySubmission(client, message);
        })
    }

    onJoin (client: Client, options: JoinOptions) {
        const username = options.username || `Player-${client.sessionId.slice(0, 4)}`;
        this.state.addPlayer(client.sessionId, new PlayerState(username));
        console.log(client.sessionId, "joined!");
    }

    onLeave (client: Client, code: CloseCode) {
        this.state.removePlayer(client.sessionId);
        console.log(client.sessionId, "left!", code);
    }

    onDispose() {
        /**
         * Called when the room is disposed.
         */
        console.log("room", this.roomId, "disposing...");
    }

    private handleCountrySubmission(client: Client , message: SubmitCountryMessage) {
        const player = this.state.getPlayer(client.sessionId);
        if (!player) return;

        const countryName = message.countryName.trim();

        if (!countryName) return;
    }
}