import { mkdir, writeFile } from "node:fs/promises";

const NATURAL_EARTH_URL =
    "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson";

const OUTPUT_PATH = "src/data/json/countries-answer-validation.json";

/**
 * Natural Earth classifies a few entities that we still want to make playable
 * with TYPE values other than "Sovereign country" or "Country".
 *
 * We keep this list explicit instead of accepting every "Sovereignty",
 * "Disputed" or "Indeterminate" feature, because those categories also contain
 * entities that are outside the rules of this game.
 */
const EXTRA_PLAYABLE_COUNTRY_IDS = new Set(["CUB", "ISR", "KAZ", "KOS"]);

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

    // Antarctica is intentionally not playable.
    if (props.CONTINENT === "Antarctica") {
        return false;
    }

    const id = getCountryId(props);

    if (!id) {
        return false;
    }

    if (EXTRA_PLAYABLE_COUNTRY_IDS.has(id)) {
        return true;
    }

    return props.TYPE === "Sovereign country" || props.TYPE === "Country";
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function countCountriesByContinent(
    countries: CountryAnswerValidation[],
): Record<ContinentCode, number> {
    return countries.reduce(
        (counts, country) => {
            counts[country.continentID] = (counts[country.continentID] ?? 0) + 1;
            return counts;
        },
        {} as Record<ContinentCode, number>,
    );
}

function validateCountries(countries: CountryAnswerValidation[]): void {
    const ids = new Set<string>();

    for (const country of countries) {
        if (ids.has(country.id)) {
            throw new Error(`Duplicate country id: ${country.id}`);
        }

        ids.add(country.id);
    }

    const missingExtraCountries = [...EXTRA_PLAYABLE_COUNTRY_IDS].filter((id) => !ids.has(id));

    if (missingExtraCountries.length > 0) {
        throw new Error(
            `Required playable countries were not found in Natural Earth: ${missingExtraCountries.join(", ")}`,
        );
    }
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

    validateCountries(countries);

    const output: CountriesAnswerValidationData = {
        countries,
    };

    await mkdir("src/data/json", { recursive: true });

    await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

    const countryCountByContinent = countCountriesByContinent(countries);

    console.log(`Extracted ${countries.length} countries for answer validation.`);
    console.log("Countries by continent:");

    for (const [continentID, countryCount] of Object.entries(countryCountByContinent)) {
        console.log(`- ${continentID}: ${countryCount}`);
    }

    console.log(`Output: ${OUTPUT_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
