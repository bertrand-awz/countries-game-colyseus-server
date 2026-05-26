import { mkdir, writeFile } from "node:fs/promises";

const NATURAL_EARTH_URL =
    "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson";

type SupportedLanguage = "fr" | "en" | "de" | "es" | "ja";

export type ContinentCode =
    | "AFRICA"
    | "ASIA"
    | "EUROPE"
    | "NORTH_AMERICA"
    | "SOUTH_AMERICA"
    | "OCEANIA"
    | "SEVEN_SEAS";

type NaturalEarthContinent =
    | "Africa"
    | "Asia"
    | "Europe"
    | "North America"
    | "South America"
    | "Oceania"
    | "Seven seas (open ocean)"
    | "Antarctica";

type NaturalEarthFeature = {
    type: "Feature";
    properties: {
        TYPE?: string;
        NAME?: string;
        NAME_EN?: string;
        NAME_FR?: string;
        NAME_DE?: string;
        NAME_ES?: string;
        NAME_JA?: string;
        ISO_A2?: string;
        ISO_A3?: string;
        ADM0_A3?: string;
        CONTINENT?: NaturalEarthContinent | string;
    };
    geometry: unknown;
};

type NaturalEarthGeoJson = {
    type: "FeatureCollection";
    features: NaturalEarthFeature[];
};

type CountryAnswerValidation = {
    id: string;
    continentID: ContinentCode;
    names: Record<SupportedLanguage, string>;
    acceptedAnswers: string[];
};

type CountriesAnswerValidationData = {
    countries: CountryAnswerValidation[];
};

const continentCodeByNaturalEarthName: Record<string, ContinentCode> = {
    Africa: "AFRICA",
    Asia: "ASIA",
    Europe: "EUROPE",
    "North America": "NORTH_AMERICA",
    "South America": "SOUTH_AMERICA",
    Oceania: "OCEANIA",
    "Seven seas (open ocean)": "SEVEN_SEAS",
};

function clean(value: string | undefined | null): string | null {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();

    if (!trimmed || trimmed === "-99") {
        return null;
    }

    return trimmed;
}

function normalizeAnswer(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[’'`´]/g, " ")
        .replace(/[-_]/g, " ")
        .replace(/[.,()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getCountryId(props: NaturalEarthFeature["properties"]): string | null {
    return (
        clean(props.ISO_A3) ||
        clean(props.ADM0_A3) ||
        clean(props.ISO_A2) ||
        clean(props.NAME_EN) ||
        clean(props.NAME) ||
        null
    );
}

function getContinentID(props: NaturalEarthFeature["properties"]): ContinentCode | null {
    const continentName = clean(props.CONTINENT);

    if (!continentName) {
        return null;
    }

    return continentCodeByNaturalEarthName[continentName] ?? null;
}

function isPlayableCountry(feature: NaturalEarthFeature): boolean {
    const props = feature.properties;

    if (!props.NAME && !props.NAME_EN) {
        return false;
    }

    // On exclut seulement Antarctica. On garde Seven seas (open ocean).
    if (props.CONTINENT === "Antarctica") {
        return false;
    }

    return props.TYPE === "Sovereign country" || props.TYPE === "Country";
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

async function main() {
    const response = await fetch(NATURAL_EARTH_URL);

    if (!response.ok) {
        throw new Error(`Failed to fetch Natural Earth data: ${response.status}`);
    }

    const geojson = (await response.json()) as NaturalEarthGeoJson;

    const countries: CountryAnswerValidation[] = geojson.features
        .filter(isPlayableCountry)
        .map((feature) => {
            const props = feature.properties;

            const fallbackName = clean(props.NAME_EN) || clean(props.NAME) || "Unknown";
            const id = getCountryId(props);

            if (!id) {
                throw new Error(`Country without valid id: ${fallbackName}`);
            }

            const continentID = getContinentID(props);

            if (!continentID) {
                throw new Error(
                    `Country without valid continent: ${fallbackName}, continent=${props.CONTINENT}`,
                );
            }

            const names: Record<SupportedLanguage, string> = {
                fr: clean(props.NAME_FR) || fallbackName,
                en: clean(props.NAME_EN) || fallbackName,
                de: clean(props.NAME_DE) || fallbackName,
                es: clean(props.NAME_ES) || fallbackName,
                ja: clean(props.NAME_JA) || fallbackName,
            };

            const acceptedAnswers = unique([
                normalizeAnswer(names.fr),
                normalizeAnswer(names.en),
                normalizeAnswer(names.de),
                normalizeAnswer(names.es),
                normalizeAnswer(names.ja),
            ]);

            return {
                id,
                continentID,
                names,
                acceptedAnswers,
            };
        })
        .sort((a, b) => a.names.en.localeCompare(b.names.en));

    const output: CountriesAnswerValidationData = {
        countries,
    };

    await mkdir("src/data/json", { recursive: true });

    await writeFile(
        "src/data/json/countries-answer-validation.json",
        JSON.stringify(output, null, 2),
        "utf-8",
    );

    console.log(`Extracted ${countries.length} countries for answer validation.`);
    console.log("Output: src/data/json/countries-answer-validation.json");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
