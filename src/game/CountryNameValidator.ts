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

export const SUPPORTED_ANSWER_VALIDATION_LANGUAGES = ["fr", "en", "de", "es", "ja"] as const;
export const ANY_ANSWER_VALIDATION_LANGUAGE = "any";

export type SupportedLanguage = (typeof SUPPORTED_ANSWER_VALIDATION_LANGUAGES)[number];
export type AnswerValidationLanguage = SupportedLanguage | typeof ANY_ANSWER_VALIDATION_LANGUAGE;

export function isSupportedLanguage(language: unknown): language is SupportedLanguage {
    return (
        typeof language === "string" &&
        SUPPORTED_ANSWER_VALIDATION_LANGUAGES.includes(language as SupportedLanguage)
    );
}

export function isAnswerValidationLanguage(
    language: unknown,
): language is AnswerValidationLanguage {
    return language === ANY_ANSWER_VALIDATION_LANGUAGE || isSupportedLanguage(language);
}

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
    private readonly normalizedAnswersByLanguage = new Map<
        SupportedLanguage,
        Map<
            string,
            {
                countryID: string;
                continentID: string;
                names: CountryNames;
            }
        >
    >();

    constructor(private readonly countries: CountryAnswerValidationData[]) {
        for (const language of SUPPORTED_ANSWER_VALIDATION_LANGUAGES) {
            this.normalizedAnswersByLanguage.set(language, new Map());
        }

        for (const country of countries) {
            for (const language of SUPPORTED_ANSWER_VALIDATION_LANGUAGES) {
                this.normalizedAnswersByLanguage
                    .get(language)
                    ?.set(this.normalize(country.names[language]), {
                        countryID: country.id,
                        continentID: country.continentID,
                        names: country.names,
                    });
            }
        }
    }

    validate(
        answer: string,
        language: AnswerValidationLanguage = ANY_ANSWER_VALIDATION_LANGUAGE,
    ): CountryValidationResult {
        const normalizedAnswer = this.normalize(answer);
        const match = this.findCountryByAnswer(normalizedAnswer, language);

        if (!match) {
            return {
                valid: false,
            };
        }

        return {
            valid: true,
            countryId: match.country.countryID,
            continentId: match.country.continentID,
            canonicalName: match.country.names[match.canonicalLanguage],
            names: match.country.names,
        };
    }

    private findCountryByAnswer(normalizedAnswer: string, language: AnswerValidationLanguage) {
        if (language !== ANY_ANSWER_VALIDATION_LANGUAGE) {
            const country = this.normalizedAnswersByLanguage.get(language)?.get(normalizedAnswer);

            return country ? { country, canonicalLanguage: language } : null;
        }

        for (const supportedLanguage of SUPPORTED_ANSWER_VALIDATION_LANGUAGES) {
            const country = this.normalizedAnswersByLanguage
                .get(supportedLanguage)
                ?.get(normalizedAnswer);

            if (country) {
                return { country, canonicalLanguage: supportedLanguage };
            }
        }

        return null;
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
