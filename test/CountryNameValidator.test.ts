import assert from "node:assert/strict";
import { describe, it } from "mocha";

import { CountryNameValidator } from "#game/CountryNameValidator.js";

const validator = new CountryNameValidator([
    {
        id: "DEU",
        continentID: "EUROPE",
        names: {
            fr: "Allemagne",
            en: "Germany",
            de: "Deutschland",
            es: "Alemania",
            ja: "ドイツ",
        },
        acceptedAnswers: [],
    },
]);

describe("CountryNameValidator", () => {
    it("accepts country names from every supported language when the player language is any", () => {
        assert.deepEqual(validator.validate("Germany", "any"), {
            valid: true,
            countryId: "DEU",
            continentId: "EUROPE",
            canonicalName: "Germany",
            names: {
                fr: "Allemagne",
                en: "Germany",
                de: "Deutschland",
                es: "Alemania",
                ja: "ドイツ",
            },
        });

        assert.equal(validator.validate("Alemania", "any").valid, true);
        assert.equal(validator.validate("ドイツ", "any").valid, true);
    });

    it("only accepts country names from the selected player language", () => {
        assert.equal(validator.validate("Allemagne", "fr").valid, true);
        assert.deepEqual(validator.validate("Germany", "fr"), {
            valid: false,
        });
    });
});
