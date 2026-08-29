export interface ScoreProvider {
    getPoints(countryISO3: string): number;
}

export class JSONScoreProvider implements ScoreProvider {
    private readonly scores: Readonly<Record<string, number>>;

    public constructor(private readonly countryScores: Readonly<Record<string, number>>) {
        this.scores = countryScores;
    }

    public getPoints(countryISO3: string): number {
        const normalizedISO3 = countryISO3.trim().toUpperCase();
        const points = this.scores[normalizedISO3];

        if (points === undefined) {
            throw new Error(`No score found for country ISO3 code: ${normalizedISO3}`);
        }

        return points;
    }
}
