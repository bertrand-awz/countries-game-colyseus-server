import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GeoJSON } from "geojson";

const DEFAULT_NATURAL_EARTH_URL =
    "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson";

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
        TYPE?: string | null;
        ISO_A3?: string | null;
        ADM0_A3?: string | null;
        SOV_A3?: string | null;
        NAME?: string | null;
        CONTINENT?: string | null;
    };
    geometry: Geometry | null;
};

type NaturalEarthGeoJson = {
    type: "FeatureCollection";
    features: NaturalEarthFeature[];
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

function isPlayableCountry(feature: NaturalEarthFeature): boolean {
    const props = feature.properties;

    if (!feature.geometry) return false;

    if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon") {
        return false;
    }

    // Garde uniquement les entités jouables pour un jeu classique.
    // Supprime ou ajuste ce filtre si tu veux inclure les dépendances/territoires.
    if (props.TYPE !== "Sovereign country" && props.TYPE !== "Country") {
        return false;
    }

    // En général, on ne demande pas Antarctica comme pays dans ce type de jeu.
    if (props.CONTINENT === "Antarctica") {
        return false;
    }

    return getCountryId(feature) !== null;
}

function toPublicCountryMapFeature(feature: NaturalEarthFeature): PublicCountryMapFeature {
    const id = getCountryId(feature);

    if (!id) {
        throw new Error(
            `Natural Earth feature without valid country id: ${feature.properties.NAME ?? "unknown"}`,
        );
    }

    if (!feature.geometry) {
        throw new Error(`Natural Earth feature without geometry: ${id}`);
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

async function main() {
    const inputPath = process.argv[2];
    const outputPath = process.argv[3] ?? DEFAULT_OUTPUT_PATH;

    const naturalEarthGeoJson = await loadNaturalEarthGeoJson(inputPath);

    const publicCountryMapFeatures: PublicCountryMapFeatureCollection = {
        type: "FeatureCollection",
        features: naturalEarthGeoJson.features
            .filter(isPlayableCountry)
            .map(toPublicCountryMapFeature)
            .sort((a, b) => a.id.localeCompare(b.id)),
    };

    await mkdir(resolve(outputPath, ".."), { recursive: true });

    await writeFile(resolve(outputPath), `${JSON.stringify(publicCountryMapFeatures)}\n`, "utf-8");

    console.log(
        `Extracted ${publicCountryMapFeatures.features.length} public country map features.`,
    );
    console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
