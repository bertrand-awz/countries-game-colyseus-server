import countriesMapDataFeatures from "../data/json/countries-map-features.json" with { type: "json" };
import type { Polygon, MultiPolygon } from "geojson";

export type PublicCountryMapFeature = {
    type: "Feature";
    id: string;
    properties: {
        id: string;
    };
    geometry: Polygon | MultiPolygon;
};

export type PublicCountryMapFeatureCollection = {
    type: "FeatureCollection";
    features: PublicCountryMapFeature[];
};

class CountriesMapService {
    private cache: PublicCountryMapFeatureCollection | null = null;

    getCountriesMapFeatures(): PublicCountryMapFeatureCollection {
        if (this.cache) {
            return this.cache;
        }

        this.cache = countriesMapDataFeatures as PublicCountryMapFeatureCollection;

        return this.cache;
    }
}

export const countriesMapService = new CountriesMapService();
