// src/data/continents.ts

export type SupportedLanguage = "fr" | "en";

export type ContinentCode =
    | "AFRICA"
    | "ASIA"
    | "EUROPE"
    | "NORTH_AMERICA"
    | "SOUTH_AMERICA"
    | "OCEANIA";

export type ContinentDetails = {
    code: ContinentCode;
    translationKey: `CONTINENTS.${ContinentCode}`;
    numberOfCountries: number;
    names: Record<SupportedLanguage, string>;
};

export const continentsDetails: ContinentDetails[] = [
    {
        code: "AFRICA",
        translationKey: "CONTINENTS.AFRICA",
        numberOfCountries: 54,
        names: {
            fr: "Afrique",
            en: "Africa",
        },
    },
    {
        code: "ASIA",
        translationKey: "CONTINENTS.ASIA",
        numberOfCountries: 49,
        names: {
            fr: "Asie",
            en: "Asia",
        },
    },
    {
        code: "EUROPE",
        translationKey: "CONTINENTS.EUROPE",
        numberOfCountries: 44,
        names: {
            fr: "Europe",
            en: "Europe",
        },
    },
    {
        code: "NORTH_AMERICA",
        translationKey: "CONTINENTS.NORTH_AMERICA",
        numberOfCountries: 23,
        names: {
            fr: "Amérique du Nord",
            en: "North America",
        },
    },
    {
        code: "SOUTH_AMERICA",
        translationKey: "CONTINENTS.SOUTH_AMERICA",
        numberOfCountries: 12,
        names: {
            fr: "Amérique du Sud",
            en: "South America",
        },
    },
    {
        code: "OCEANIA",
        translationKey: "CONTINENTS.OCEANIA",
        numberOfCountries: 14,
        names: {
            fr: "Océanie",
            en: "Oceania",
        },
    },
];

export function buildContinentsTranslations() {
    return {
        fr: {
            CONTINENTS: Object.fromEntries(
                continentsDetails.map((continent) => [
                    continent.code,
                    continent.names.fr,
                ]),
            ),
        },
        en: {
            CONTINENTS: Object.fromEntries(
                continentsDetails.map((continent) => [
                    continent.code,
                    continent.names.en,
                ]),
            ),
        },
    };
}