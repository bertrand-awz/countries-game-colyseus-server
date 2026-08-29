import { area } from "@turf/area";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

const COUNTRIES_ANSWER_VALIDATION_PATH = "src/data/json/countries-answer-validation.json";

const COUNTRIES_MAP_FEATURES_PATH = "src/data/json/countries-map-features.json";

const FULL_OUTPUT_PATH = "src/data/json/country-scores.full.json";

const COMPACT_OUTPUT_PATH = "src/data/json/country-scores.json";

const MLEDOZE_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";

const JETPUNK_RECOGNITION_PATH = "src/data/json/jetpunk-country-recognition.json";

const EXPECTED_JETPUNK_COUNTRY_COUNT = 196;

const SCORING = {
    minScore: 100,
    areaScoreRange: 600,
    recognitionBonusRange: 400,
    areaExponent: 1.25,
    recognitionExponent: 1.2,
    roundTo: 10,
} as const;

type SupportedLanguage = "fr" | "en" | "de" | "es" | "ja";

type CountryAnswerValidation = {
    id: string;
    continentID: string;
    names: Record<SupportedLanguage, string>;
    acceptedAnswers: string[];
};

type CountriesAnswerValidationData = {
    countries: CountryAnswerValidation[];
};

type Geometry = Polygon | MultiPolygon;

type PublicCountryMapFeature = Feature<Geometry, { id: string }> & {
    id: string;
};

type PublicCountryMapFeatureCollection = FeatureCollection<Geometry, { id: string }> & {
    features: PublicCountryMapFeature[];
};

type MledozeCountry = {
    name: {
        common: string;
        official: string;
    };
    cca3: string;
    cioc?: string;
    area: number;
};

type JetPunkStatistic = {
    name: string;
    recognitionRate: number;
};

type JetPunkRecognitionSnapshot = {
    version: number;
    capturedAt: string;
    source: string;
    quiz: string;
    countryCount: number;
    countries: JetPunkStatistic[];
};

type CountrySourceData = {
    id: string;
    name: string;
    continentID: string;
    areaKm2: number;
    areaSource: "mledoze" | "map-geometry";
    recognitionRate: number | null;
};

type CountryScore = {
    id: string;
    name: string;
    continentID: string;

    areaKm2: number;
    areaSource: "mledoze" | "map-geometry";
    areaRank: number;
    areaDifficulty: number;

    recognitionRate: number | null;
    recognitionDifficulty: number | null;
    recognitionSource: "jetpunk" | null;

    areaScore: number;
    recognitionBonus: number;
    score: number;
};

/**
 * mledoze représente actuellement le Kosovo avec cca3="UNK"
 * et cioc="KOS".
 */
const MLEDOZE_ID_OVERRIDES: Record<string, string> = {
    KOS: "UNK",
};

/**
 * Noms JetPunk qui ne correspondent pas exactement au names.en
 * généré depuis Natural Earth.
 */
const JETPUNK_ID_OVERRIDES: Record<string, string> = {
    "united states": "USA",
    china: "CHN",
    bahamas: "BHS",
};

function normalizeCountryName(value: string): string {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[’'`´]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/^the\s+/, "")
        .replace(/\s+/g, " ")
        .trim();
}

function round(value: number, decimals = 4): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function roundTo(value: number, step: number): number {
    return Math.round(value / step) * step;
}

async function readJson<T>(path: string): Promise<T> {
    const content = await readFile(resolve(path), "utf8");
    return JSON.parse(content) as T;
}

async function loadAcceptedCountries(): Promise<CountryAnswerValidation[]> {
    const data = await readJson<CountriesAnswerValidationData>(COUNTRIES_ANSWER_VALIDATION_PATH);

    if (!Array.isArray(data.countries) || data.countries.length === 0) {
        throw new Error("countries-answer-validation.json contains no countries.");
    }

    const ids = new Set<string>();

    for (const country of data.countries) {
        if (ids.has(country.id)) {
            throw new Error(`Duplicate accepted country id: ${country.id}`);
        }

        ids.add(country.id);
    }

    return data.countries;
}

async function loadMapFeatures(): Promise<PublicCountryMapFeature[]> {
    const data = await readJson<PublicCountryMapFeatureCollection>(COUNTRIES_MAP_FEATURES_PATH);

    if (!Array.isArray(data.features) || data.features.length === 0) {
        throw new Error("countries-map-features.json contains no features.");
    }

    const ids = new Set<string>();

    for (const feature of data.features) {
        if (ids.has(feature.id)) {
            throw new Error(`Duplicate map feature id: ${feature.id}`);
        }

        ids.add(feature.id);
    }

    return data.features;
}

async function fetchMledozeCountries(): Promise<MledozeCountry[]> {
    console.log("Downloading country areas from mledoze/countries...");

    const response = await fetch(MLEDOZE_URL);

    if (!response.ok) {
        throw new Error(
            `Unable to fetch mledoze countries: ${response.status} ${response.statusText}`,
        );
    }

    return (await response.json()) as MledozeCountry[];
}

async function loadJetPunkRecognitionSnapshot(): Promise<JetPunkRecognitionSnapshot> {
    console.log("Loading local JetPunk recognition snapshot...");

    const snapshot = await readJson<JetPunkRecognitionSnapshot>(JETPUNK_RECOGNITION_PATH);

    if (!Array.isArray(snapshot.countries)) {
        throw new Error(`${JETPUNK_RECOGNITION_PATH} does not contain a countries array.`);
    }

    if (
        snapshot.countryCount !== EXPECTED_JETPUNK_COUNTRY_COUNT ||
        snapshot.countries.length !== EXPECTED_JETPUNK_COUNTRY_COUNT
    ) {
        throw new Error(
            `Expected ${EXPECTED_JETPUNK_COUNTRY_COUNT} JetPunk countries, ` +
                `got countryCount=${snapshot.countryCount}, ` +
                `countries.length=${snapshot.countries.length}.`,
        );
    }

    const names = new Set<string>();

    for (const statistic of snapshot.countries) {
        if (!statistic.name.trim()) {
            throw new Error("JetPunk snapshot contains an empty country name.");
        }

        if (
            !Number.isFinite(statistic.recognitionRate) ||
            statistic.recognitionRate < 0 ||
            statistic.recognitionRate > 1
        ) {
            throw new Error(
                `Invalid recognition rate for ${statistic.name}: ` + `${statistic.recognitionRate}`,
            );
        }

        const normalizedName = normalizeCountryName(statistic.name);

        if (names.has(normalizedName)) {
            throw new Error(`Duplicate JetPunk country name in snapshot: ${statistic.name}`);
        }

        names.add(normalizedName);
    }

    return snapshot;
}

function validateCountrySets(
    acceptedCountries: CountryAnswerValidation[],
    mapFeatures: PublicCountryMapFeature[],
): void {
    const acceptedIds = new Set(acceptedCountries.map((country) => country.id));
    const mapIds = new Set(mapFeatures.map((feature) => feature.id));

    const missingMapFeatures = acceptedCountries.filter((country) => !mapIds.has(country.id));

    const unexpectedMapFeatures = mapFeatures.filter((feature) => !acceptedIds.has(feature.id));

    if (missingMapFeatures.length > 0 || unexpectedMapFeatures.length > 0) {
        const details = [
            missingMapFeatures.length > 0
                ? `Missing map features: ${missingMapFeatures
                      .map((country) => country.id)
                      .join(", ")}`
                : null,
            unexpectedMapFeatures.length > 0
                ? `Unexpected map features: ${unexpectedMapFeatures
                      .map((feature) => feature.id)
                      .join(", ")}`
                : null,
        ]
            .filter(Boolean)
            .join("\n");

        throw new Error(
            "Accepted countries and map features do not contain the same IDs.\n" + details,
        );
    }
}

function buildRecognitionRatesById(
    acceptedCountries: CountryAnswerValidation[],
    statistics: JetPunkStatistic[],
): Map<string, number> {
    const acceptedByNormalizedEnglishName = new Map<string, CountryAnswerValidation>();

    const acceptedById = new Map(acceptedCountries.map((country) => [country.id, country]));

    for (const country of acceptedCountries) {
        const normalizedName = normalizeCountryName(country.names.en);

        const existing = acceptedByNormalizedEnglishName.get(normalizedName);

        if (existing) {
            throw new Error(
                `Duplicate normalized English country name: "${normalizedName}" ` +
                    `(${existing.id}, ${country.id})`,
            );
        }

        acceptedByNormalizedEnglishName.set(normalizedName, country);
    }

    const recognitionRatesById = new Map<string, number>();
    const unmatchedJetPunkNames: string[] = [];

    for (const statistic of statistics) {
        const normalizedJetPunkName = normalizeCountryName(statistic.name);

        const overrideId = JETPUNK_ID_OVERRIDES[normalizedJetPunkName];

        const country = overrideId
            ? acceptedById.get(overrideId)
            : acceptedByNormalizedEnglishName.get(normalizedJetPunkName);

        if (!country) {
            unmatchedJetPunkNames.push(statistic.name);
            continue;
        }

        if (recognitionRatesById.has(country.id)) {
            throw new Error(`Multiple JetPunk statistics mapped to country ${country.id}.`);
        }

        recognitionRatesById.set(country.id, statistic.recognitionRate);
    }

    if (unmatchedJetPunkNames.length > 0) {
        throw new Error(
            "Some JetPunk countries could not be matched to the playable list:\n" +
                unmatchedJetPunkNames.map((name) => `- ${name}`).join("\n"),
        );
    }

    if (recognitionRatesById.size !== EXPECTED_JETPUNK_COUNTRY_COUNT) {
        throw new Error(
            `Expected ${EXPECTED_JETPUNK_COUNTRY_COUNT} matched JetPunk countries, ` +
                `got ${recognitionRatesById.size}.`,
        );
    }

    return recognitionRatesById;
}

function buildMledozeIndex(countries: MledozeCountry[]): Map<string, MledozeCountry> {
    const byCca3 = new Map<string, MledozeCountry>();

    for (const country of countries) {
        if (country.cca3) {
            byCca3.set(country.cca3, country);
        }
    }

    return byCca3;
}

function resolveArea(
    country: CountryAnswerValidation,
    mledozeByCca3: Map<string, MledozeCountry>,
    mapFeaturesById: Map<string, PublicCountryMapFeature>,
): {
    areaKm2: number;
    areaSource: "mledoze" | "map-geometry";
} {
    const mledozeId = MLEDOZE_ID_OVERRIDES[country.id] ?? country.id;
    const statisticalCountry = mledozeByCca3.get(mledozeId);

    if (
        statisticalCountry &&
        Number.isFinite(statisticalCountry.area) &&
        statisticalCountry.area > 0
    ) {
        return {
            areaKm2: statisticalCountry.area,
            areaSource: "mledoze",
        };
    }

    const feature = mapFeaturesById.get(country.id);

    if (!feature) {
        throw new Error(
            `Unable to find either statistical area or map geometry for ${country.id}.`,
        );
    }

    const computedAreaKm2 = area(feature) / 1_000_000;

    if (!Number.isFinite(computedAreaKm2) || computedAreaKm2 <= 0) {
        throw new Error(
            `Invalid area computed from map geometry for ${country.id}: ${computedAreaKm2}`,
        );
    }

    return {
        areaKm2: computedAreaKm2,
        areaSource: "map-geometry",
    };
}

function buildCountrySourceData(
    acceptedCountries: CountryAnswerValidation[],
    mapFeatures: PublicCountryMapFeature[],
    mledozeCountries: MledozeCountry[],
    recognitionRatesById: Map<string, number>,
): CountrySourceData[] {
    const mapFeaturesById = new Map(mapFeatures.map((feature) => [feature.id, feature]));

    const mledozeByCca3 = buildMledozeIndex(mledozeCountries);

    return acceptedCountries.map((country) => {
        const { areaKm2, areaSource } = resolveArea(country, mledozeByCca3, mapFeaturesById);

        return {
            id: country.id,
            name: country.names.en,
            continentID: country.continentID,
            areaKm2,
            areaSource,
            recognitionRate: recognitionRatesById.get(country.id) ?? null,
        };
    });
}

function computeCountryScores(countries: CountrySourceData[]): CountryScore[] {
    const sortedByArea = [...countries].sort((a, b) => {
        const areaDifference = b.areaKm2 - a.areaKm2;

        if (areaDifference !== 0) {
            return areaDifference;
        }

        return a.id.localeCompare(b.id);
    });

    return sortedByArea.map((country, index) => {
        const areaRank = index + 1;

        /**
         * 0 = plus grand pays/territoire jouable
         * 1 = plus petit pays/territoire jouable
         */
        const areaDifficulty = sortedByArea.length === 1 ? 0 : index / (sortedByArea.length - 1);

        const recognitionDifficulty =
            country.recognitionRate === null ? null : 1 - country.recognitionRate;

        const areaScore =
            SCORING.minScore +
            SCORING.areaScoreRange * Math.pow(areaDifficulty, SCORING.areaExponent);

        /**
         * Si JetPunk n'a aucune donnée pour cette entité, on n'invente pas
         * de difficulté : le bonus de reconnaissance vaut 0.
         */
        const recognitionBonus =
            recognitionDifficulty === null
                ? 0
                : SCORING.recognitionBonusRange *
                  Math.pow(recognitionDifficulty, SCORING.recognitionExponent);

        const score = Math.min(1000, roundTo(areaScore + recognitionBonus, SCORING.roundTo));

        return {
            id: country.id,
            name: country.name,
            continentID: country.continentID,

            areaKm2: round(country.areaKm2, 2),
            areaSource: country.areaSource,
            areaRank,
            areaDifficulty: round(areaDifficulty),

            recognitionRate:
                country.recognitionRate === null ? null : round(country.recognitionRate),
            recognitionDifficulty:
                recognitionDifficulty === null ? null : round(recognitionDifficulty),
            recognitionSource: country.recognitionRate === null ? null : "jetpunk",

            areaScore: Math.round(areaScore),
            recognitionBonus: Math.round(recognitionBonus),
            score,
        };
    });
}

function validateScores(
    acceptedCountries: CountryAnswerValidation[],
    scores: CountryScore[],
): void {
    if (scores.length !== acceptedCountries.length) {
        throw new Error(`Expected ${acceptedCountries.length} scores, got ${scores.length}.`);
    }

    const scoresById = new Map(scores.map((country) => [country.id, country]));

    const missingScores = acceptedCountries.filter((country) => !scoresById.has(country.id));

    if (missingScores.length > 0) {
        throw new Error(
            "Missing scores:\n" +
                missingScores.map((country) => `- ${country.id} (${country.names.en})`).join("\n"),
        );
    }

    for (const country of scores) {
        if (country.score < SCORING.minScore || country.score > 1000) {
            throw new Error(`Score out of range for ${country.id}: ${country.score}`);
        }
    }
}

async function writeResults(
    scores: CountryScore[],
    jetPunkSnapshot: JetPunkRecognitionSnapshot,
): Promise<void> {
    const generatedAt = new Date().toISOString();

    const sortedById = [...scores].sort((a, b) => a.id.localeCompare(b.id));

    const fullOutput = {
        version: 1,
        generatedAt,
        sources: {
            area: MLEDOZE_URL,
            areaFallback: COUNTRIES_MAP_FEATURES_PATH,
            recognitionSnapshot: JETPUNK_RECOGNITION_PATH,
            recognitionOriginalSource: jetPunkSnapshot.source,
            recognitionCapturedAt: jetPunkSnapshot.capturedAt,
        },
        formula: {
            ...SCORING,
            areaDifficulty: "rank percentile among playable entities, largest=0 and smallest=1",
            recognitionDifficulty: "1 - JetPunk recognition rate",
            missingRecognitionBonus: 0,
        },
        countries: sortedById,
    };

    const compactOutput = Object.fromEntries(
        sortedById.map((country) => [country.id, country.score]),
    );

    await mkdir(dirname(resolve(FULL_OUTPUT_PATH)), {
        recursive: true,
    });

    await writeFile(resolve(FULL_OUTPUT_PATH), `${JSON.stringify(fullOutput, null, 2)}\n`, "utf8");

    await writeFile(
        resolve(COMPACT_OUTPUT_PATH),
        `${JSON.stringify(compactOutput, null, 2)}\n`,
        "utf8",
    );
}

async function main(): Promise<void> {
    const acceptedCountries = await loadAcceptedCountries();
    const mapFeatures = await loadMapFeatures();

    validateCountrySets(acceptedCountries, mapFeatures);

    const [mledozeCountries, jetPunkSnapshot] = await Promise.all([
        fetchMledozeCountries(),
        loadJetPunkRecognitionSnapshot(),
    ]);

    const jetPunkStatistics = jetPunkSnapshot.countries;

    const recognitionRatesById = buildRecognitionRatesById(acceptedCountries, jetPunkStatistics);

    const sourceData = buildCountrySourceData(
        acceptedCountries,
        mapFeatures,
        mledozeCountries,
        recognitionRatesById,
    );

    const scores = computeCountryScores(sourceData);

    validateScores(acceptedCountries, scores);

    await writeResults(scores, jetPunkSnapshot);

    const withoutJetPunk = scores
        .filter((country) => country.recognitionRate === null)
        .sort((a, b) => a.id.localeCompare(b.id));

    const geometryFallbacks = scores
        .filter((country) => country.areaSource === "map-geometry")
        .sort((a, b) => a.id.localeCompare(b.id));

    console.log("");
    console.log(`Playable countries/territories: ${acceptedCountries.length}`);
    console.log(`Map features:                 ${mapFeatures.length}`);
    console.log(`JetPunk statistics:           ${jetPunkStatistics.length}`);
    console.log(`JetPunk matches:              ${recognitionRatesById.size}`);
    console.log(`Without JetPunk data:         ${withoutJetPunk.length}`);
    console.log(`Geometry area fallbacks:      ${geometryFallbacks.length}`);
    console.log(`Generated scores:             ${scores.length}`);

    if (withoutJetPunk.length > 0) {
        console.log("");
        console.log("Entities without JetPunk recognition data:");

        for (const country of withoutJetPunk) {
            console.log(`- ${country.id}: ${country.name}`);
        }
    }

    if (geometryFallbacks.length > 0) {
        console.log("");
        console.log("Entities using map geometry for area:");

        for (const country of geometryFallbacks) {
            console.log(`- ${country.id}: ${country.name} (${country.areaKm2} km²)`);
        }
    }

    console.log("");
    console.log(`Output: ${FULL_OUTPUT_PATH}`);
    console.log(`Output: ${COMPACT_OUTPUT_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
