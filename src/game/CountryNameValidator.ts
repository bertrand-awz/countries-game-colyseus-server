export type CountryNames = {
    fr: string;
    en: string;
    de: string;
    es: string;
    ja: string;
};

export type CountryAnswerValidationData = {
    id: string;
    continentID: string;
    names: CountryNames;
    acceptedAnswers: string[];
};

export type SupportedLanguage = keyof CountryNames;

export type CountryValidationResult =
    | {
          valid: true;
          countryId: string;
          continentId: string;
          canonicalName: string;
          names: CountryNames;
      }
    | {
          valid: false;
      };

export class CountryNameValidator {
    private readonly normalizedAnswers = new Map<
        string,
        {
            countryID: string;
            continentID: string;
            names: CountryNames;
        }
    >();

    constructor(private readonly countries: CountryAnswerValidationData[]) {
        for (const country of countries) {
            const acceptedAnswers = [...Object.values(country.names), ...country.acceptedAnswers];

            for (const acceptedAnswer of acceptedAnswers) {
                this.normalizedAnswers.set(this.normalize(acceptedAnswer), {
                    countryID: country.id,
                    continentID: country.continentID,
                    names: country.names,
                });
            }
        }
    }

    validate(answer: string, language: SupportedLanguage = "fr"): CountryValidationResult {
        const normalizedAnswer = this.normalize(answer);
        const country = this.normalizedAnswers.get(normalizedAnswer);

        if (!country) {
            return {
                valid: false,
            };
        }

        return {
            valid: true,
            countryId: country.countryID,
            continentId: country.continentID,
            canonicalName: country.names[language],
            names: country.names,
        };
    }

    private normalize(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/[’'`´.-]/g, " ")
            .replace(/[^a-z0-9\s\u3040-\u30ff\u3400-\u9fff]/gu, "")
            .replace(/\s+/g, " ")
            .trim();
    }
}
