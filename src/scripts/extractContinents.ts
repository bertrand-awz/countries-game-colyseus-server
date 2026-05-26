import { mkdir, writeFile } from "node:fs/promises";
import { continentsDetails } from "#data/continents.js";

type ContinentJsonData = {
    code: string;
    naturalEarthName: string;
    translationKey: string;
    numberOfCountries: number;
    names: {
        fr: string;
        en: string;
    };
};

type ContinentsJsonData = {
    continents: ContinentJsonData[];
};

async function main() {
    const output: ContinentsJsonData = {
        continents: continentsDetails.map((continent) => ({
            code: continent.code,
            naturalEarthName: continent.naturalEarthName,
            translationKey: continent.translationKey,
            numberOfCountries: continent.numberOfCountries,
            names: continent.names,
        })),
    };

    await mkdir("src/data/json", { recursive: true });

    await writeFile("src/data/json/continents.json", JSON.stringify(output, null, 2), "utf-8");

    console.log(`Extracted ${output.continents.length} continents.`);
    console.log("Output: src/data/json/continents.json");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
