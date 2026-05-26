import countriesAnswerValidationData from "#data/json/countries-answer-validation.json" with { type: "json" };

export type SupportedLanguage = "fr" | "en" | "de" | "es" | "ja";

export type CountryAnswerValidation = {
    id: string;
    names: Record<SupportedLanguage, string>;
    acceptedAnswers: string[];
};

export type CountriesAnswerValidationData = {
    countries: CountryAnswerValidation[];
};

export type CountryAnswerValidationResult =
    | {
          correct: true;
          countryId: string;
      }
    | {
          correct: false;
          reason: "EMPTY_ANSWER" | "UNKNOWN_COUNTRY" | "ALREADY_FOUND";
      };

class CountriesAnswerValidationService {
    private readonly countriesByAnswer = new Map<string, CountryAnswerValidation>();

    constructor() {
        const data = countriesAnswerValidationData as CountriesAnswerValidationData;

        for (const country of data.countries) {
            for (const acceptedAnswer of country.acceptedAnswers) {
                this.countriesByAnswer.set(acceptedAnswer, country);
            }
        }
    }

    validateAnswer(
        rawAnswer: string,
        alreadyFoundCountryIds: Set<string>,
    ): CountryAnswerValidationResult {
        const normalizedAnswer = this.normalizeAnswer(rawAnswer);

        if (!normalizedAnswer) {
            return {
                correct: false,
                reason: "EMPTY_ANSWER",
            };
        }

        const country = this.countriesByAnswer.get(normalizedAnswer);

        if (!country) {
            return {
                correct: false,
                reason: "UNKNOWN_COUNTRY",
            };
        }

        if (alreadyFoundCountryIds.has(country.id)) {
            return {
                correct: false,
                reason: "ALREADY_FOUND",
            };
        }

        return {
            correct: true,
            countryId: country.id,
        };
    }

    private normalizeAnswer(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/[’']/g, " ")
            .replace(/[-_]/g, " ")
            .replace(/[.,()]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
}

export const countriesAnswerValidationService = new CountriesAnswerValidationService();
