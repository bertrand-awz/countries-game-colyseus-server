import { Schema, type } from "@colyseus/schema";
import type { AnswerValidationLanguage } from "#game/CountryNameValidator.js";

export class PlayerState extends Schema {
    @type("string")
    id: string;

    @type("string")
    username: string;

    @type("number")
    score: number = 0;

    @type("number")
    totalCountriesFound: number = 0;

    @type("number")
    colorSlot: number = 0;

    @type("string")
    answerValidationLanguage: AnswerValidationLanguage;

    constructor(
        id: string,
        username: string,
        answerValidationLanguage: AnswerValidationLanguage = "any",
        colorSlot: number = 0,
    ) {
        super();
        this.id = id;
        this.username = username;
        this.answerValidationLanguage = answerValidationLanguage;
        this.colorSlot = colorSlot;
    }

    addScore(points: number) {
        this.score += points;
    }

    incrementCountriesFound() {
        this.totalCountriesFound++;
    }

    resetProgress() {
        this.score = 0;
        this.totalCountriesFound = 0;
    }

    updateAnswerValidationLanguage(language: AnswerValidationLanguage) {
        this.answerValidationLanguage = language;
    }
}
