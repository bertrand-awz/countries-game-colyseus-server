import { mkdir, writeFile } from "node:fs/promises";
import { continentsDetails } from "#data/continents.js";

type ContinentJsonData = {
    id: string;
    countriesNumber: number;
};

async function main() {
    const output: ContinentJsonData[] = continentsDetails.map((continent) => ({
        id: continent.code,
        countriesNumber: continent.numberOfCountries,
    }));

    await mkdir("src/data/json", { recursive: true });

    await writeFile("src/data/json/continents.json", `${JSON.stringify(output, null, 2)}\n`, "utf-8");

    console.log(`Extracted ${output.length} continents.`);
    console.log("Output: src/data/json/continents.json");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
