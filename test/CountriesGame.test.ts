import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { CountriesGame } from "#game/CountriesGame.js";
import { CountryNameValidator } from "#game/CountryNameValidator.js";
import type { ScoreProvider } from "#game/ScoreProvider.js";
import { CountriesGameState } from "#rooms/schema/CountriesGameState.js";

function createGame(randomNumberGenerator: () => number) {
    const state = new CountriesGameState("en", 180, 45, 8);
    const answerValidator = new CountryNameValidator([]);
    const scoreProvider: ScoreProvider = {
        getPoints: () => 1,
    };

    return {
        state,
        game: new CountriesGame(state, answerValidator, scoreProvider, 0, randomNumberGenerator),
    };
}

describe("CountriesGame", () => {
    it("assigns a random available color slot to each new active player", () => {
        const randomValues = [0.99, 0.5, 0];
        const { game, state } = createGame(() => randomValues.shift() ?? 0);

        game.addPlayer("player-1", "Player 1");
        game.addPlayer("player-2", "Player 2");
        game.addPlayer("player-3", "Player 3");

        assert.deepEqual(
            state.players.map((player) => player.colorSlot),
            [7, 3, 0],
        );
    });
});
