export type SupportedLanguage = "fr" | "en";

export type ContinentCode =
    | "AFRICA"
    | "ASIA"
    | "EUROPE"
    | "NORTH_AMERICA"
    | "SOUTH_AMERICA"
    | "OCEANIA"
    | "SEVEN_SEAS";

export type ContinentDetails = {
    code: ContinentCode;
    naturalEarthName: string;
    translationKey: `CONTINENTS.${ContinentCode}`;
    numberOfCountries: number;
    names: Record<SupportedLanguage, string>;
};

export const continentsDetails: ContinentDetails[] = [
    {
        code: "AFRICA",
        naturalEarthName: "Africa",
        translationKey: "CONTINENTS.AFRICA",
        numberOfCountries: 54,
        names: {
            fr: "Afrique",
            en: "Africa",
        },
    },
    {
        code: "ASIA",
        naturalEarthName: "Asia",
        translationKey: "CONTINENTS.ASIA",
        numberOfCountries: 49,
        names: {
            fr: "Asie",
            en: "Asia",
        },
    },
    {
        code: "EUROPE",
        naturalEarthName: "Europe",
        translationKey: "CONTINENTS.EUROPE",
        numberOfCountries: 44,
        names: {
            fr: "Europe",
            en: "Europe",
        },
    },
    {
        code: "NORTH_AMERICA",
        naturalEarthName: "North America",
        translationKey: "CONTINENTS.NORTH_AMERICA",
        numberOfCountries: 23,
        names: {
            fr: "Amérique du Nord",
            en: "North America",
        },
    },
    {
        code: "SOUTH_AMERICA",
        naturalEarthName: "South America",
        translationKey: "CONTINENTS.SOUTH_AMERICA",
        numberOfCountries: 12,
        names: {
            fr: "Amérique du Sud",
            en: "South America",
        },
    },
    {
        code: "OCEANIA",
        naturalEarthName: "Oceania",
        translationKey: "CONTINENTS.OCEANIA",
        numberOfCountries: 14,
        names: {
            fr: "Océanie",
            en: "Oceania",
        },
    },
    {
        code: "SEVEN_SEAS",
        naturalEarthName: "Seven seas (open ocean)",
        translationKey: "CONTINENTS.SEVEN_SEAS",
        numberOfCountries: 0,
        names: {
            fr: "Sept mers",
            en: "Seven seas",
        },
    },
];

export function buildContinentsTranslations() {
    return {
        fr: {
            CONTINENTS: Object.fromEntries(
                continentsDetails.map((continent) => [continent.code, continent.names.fr]),
            ),
        },
        en: {
            CONTINENTS: Object.fromEntries(
                continentsDetails.map((continent) => [continent.code, continent.names.en]),
            ),
        },
    };
}
