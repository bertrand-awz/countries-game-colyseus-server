import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { GeoJSON } from "geojson";

const DEFAULT_NATURAL_EARTH_URL =
    "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson";

const DEFAULT_VALIDATION_PATH = "src/data/json/countries-answer-validation.json";
const DEFAULT_OUTPUT_PATH = "src/data/json/countries-map-features.json";

type Geometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

type PublicCountryMapFeature = {
    type: "Feature";
    id: string;
    properties: {
        id: string;
    };
    geometry: Geometry;
};

type PublicCountryMapFeatureCollection = {
    type: "FeatureCollection";
    features: PublicCountryMapFeature[];
};

type NaturalEarthFeature = {
    type: "Feature";
    properties: {
        ISO_A3?: string | null;
        ADM0_A3?: string | null;
        SOV_A3?: string | null;
        NAME?: string | null;
    };
    geometry: Geometry | null;
};

type NaturalEarthGeoJson = {
    type: "FeatureCollection";
    features: NaturalEarthFeature[];
};

type CountriesAnswerValidationData = {
    countries: Array<{
        id: string;
    }>;
};

function cleanCode(value: string | null | undefined): string | null {
    if (!value) return null;

    const normalizedValue = value.trim();

    if (!normalizedValue || normalizedValue === "-99") {
        return null;
    }

    return normalizedValue;
}

function getCountryId(feature: NaturalEarthFeature): string | null {
    const props = feature.properties;

    return cleanCode(props.ISO_A3) ?? cleanCode(props.ADM0_A3) ?? cleanCode(props.SOV_A3) ?? null;
}

function hasSupportedGeometry(
    feature: NaturalEarthFeature,
): feature is NaturalEarthFeature & { geometry: Geometry } {
    return feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon";
}

function toPublicCountryMapFeature(feature: NaturalEarthFeature): PublicCountryMapFeature {
    const id = getCountryId(feature);

    if (!id) {
        throw new Error(
            `Natural Earth feature without valid country id: ${feature.properties.NAME ?? "unknown"}`,
        );
    }

    if (!hasSupportedGeometry(feature)) {
        throw new Error(`Natural Earth feature without supported geometry: ${id}`);
    }

    return {
        type: "Feature",
        id,
        properties: {
            id,
        },
        geometry: feature.geometry,
    };
}

async function loadNaturalEarthGeoJson(input?: string): Promise<NaturalEarthGeoJson> {
    if (input) {
        const fileContent = await readFile(resolve(input), "utf-8");
        return JSON.parse(fileContent) as NaturalEarthGeoJson;
    }

    const response = await fetch(DEFAULT_NATURAL_EARTH_URL);

    if (!response.ok) {
        throw new Error(
            `Unable to fetch Natural Earth GeoJSON: ${response.status} ${response.statusText}`,
        );
    }

    return (await response.json()) as NaturalEarthGeoJson;
}

async function loadAcceptedCountryIds(validationPath: string): Promise<Set<string>> {
    const fileContent = await readFile(resolve(validationPath), "utf-8");
    const data = JSON.parse(fileContent) as CountriesAnswerValidationData;

    const ids = new Set<string>();

    for (const country of data.countries) {
        if (ids.has(country.id)) {
            throw new Error(`Duplicate country id in validation data: ${country.id}`);
        }

        ids.add(country.id);
    }

    return ids;
}

function validateFeatureCoverage(
    acceptedCountryIds: Set<string>,
    features: PublicCountryMapFeature[],
): void {
    const featureIds = new Set<string>();

    for (const feature of features) {
        if (featureIds.has(feature.id)) {
            throw new Error(`Duplicate map feature id: ${feature.id}`);
        }

        featureIds.add(feature.id);
    }

    const missingIds = [...acceptedCountryIds].filter((id) => !featureIds.has(id)).sort();

    if (missingIds.length > 0) {
        throw new Error(`Missing map features for accepted countries: ${missingIds.join(", ")}`);
    }

    if (features.length !== acceptedCountryIds.size) {
        throw new Error(
            `Map/validation count mismatch: ${features.length} map features for ${acceptedCountryIds.size} accepted countries.`,
        );
    }
}

async function main() {
    const inputPath = process.argv[2];
    const outputPath = process.argv[3] ?? DEFAULT_OUTPUT_PATH;
    const validationPath = process.argv[4] ?? DEFAULT_VALIDATION_PATH;

    const [naturalEarthGeoJson, acceptedCountryIds] = await Promise.all([
        loadNaturalEarthGeoJson(inputPath),
        loadAcceptedCountryIds(validationPath),
    ]);

    const features = naturalEarthGeoJson.features
        .filter(hasSupportedGeometry)
        .filter((feature) => {
            const id = getCountryId(feature);
            return id !== null && acceptedCountryIds.has(id);
        })
        .map(toPublicCountryMapFeature)
        .sort((a, b) => a.id.localeCompare(b.id));

    validateFeatureCoverage(acceptedCountryIds, features);

    const publicCountryMapFeatures: PublicCountryMapFeatureCollection = {
        type: "FeatureCollection",
        features,
    };

    await mkdir(dirname(resolve(outputPath)), { recursive: true });

    await writeFile(resolve(outputPath), `${JSON.stringify(publicCountryMapFeatures)}\n`, "utf-8");

    console.log(`Accepted countries: ${acceptedCountryIds.size}`);
    console.log(
        `Extracted ${publicCountryMapFeatures.features.length} public country map features.`,
    );
    console.log("Missing map features: 0");
    console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
