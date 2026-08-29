import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { continentsDetails } from "#data/continents.js";

const DEFAULT_COUNTRIES_PATH = "src/data/json/countries-answer-validation.json";
const DEFAULT_OUTPUT_PATH = "src/data/json/continents.json";

type ContinentJsonData = {
    id: string;
    countriesNumber: number;
};

type CountriesAnswerValidationData = {
    countries: Array<{
        id: string;
        continentID: string;
    }>;
};

async function loadCountries(path: string): Promise<CountriesAnswerValidationData> {
    const content = await readFile(resolve(path), "utf-8");
    return JSON.parse(content) as CountriesAnswerValidationData;
}

async function main() {
    const countriesPath = process.argv[2] ?? DEFAULT_COUNTRIES_PATH;
    const outputPath = process.argv[3] ?? DEFAULT_OUTPUT_PATH;

    const data = await loadCountries(countriesPath);

    const knownContinentIds = new Set(continentsDetails.map((continent) => continent.code));
    const countsByContinent = new Map<string, number>();

    for (const country of data.countries) {
        if (!knownContinentIds.has(country.continentID)) {
            throw new Error(
                `Unknown continent id ${country.continentID} for country ${country.id}`,
            );
        }

        countsByContinent.set(
            country.continentID,
            (countsByContinent.get(country.continentID) ?? 0) + 1,
        );
    }

    const output: ContinentJsonData[] = continentsDetails.map((continent) => ({
        id: continent.code,
        countriesNumber: countsByContinent.get(continent.code) ?? 0,
    }));

    await mkdir(dirname(resolve(outputPath)), { recursive: true });

    await writeFile(resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`, "utf-8");

    console.log(`Extracted ${output.length} continents from ${data.countries.length} countries.`);
    console.log(`Output: ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
