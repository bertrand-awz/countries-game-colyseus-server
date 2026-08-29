type MinMaxConstraint = {
    min: number;
    max: number;
};

export const PLAYER_COLOR_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export const GameRoomConstraints = {
    TURN_DURATION_IN_SECONDS: {
        min: 30,
        max: 55,
        default: 45,
    } satisfies MinMaxConstraint & { default: number },
};

export function isTurnDurationInSecondsAllowed(turnDurationInSeconds: number): boolean {
    return (
        Number.isInteger(turnDurationInSeconds) &&
        turnDurationInSeconds >= GameRoomConstraints.TURN_DURATION_IN_SECONDS.min &&
        turnDurationInSeconds <= GameRoomConstraints.TURN_DURATION_IN_SECONDS.max
    );
}

export function normalizeTurnDurationInSeconds(turnDurationInSeconds: unknown): number {
    if (
        typeof turnDurationInSeconds === "number" &&
        isTurnDurationInSecondsAllowed(turnDurationInSeconds)
    ) {
        return turnDurationInSeconds;
    }

    return GameRoomConstraints.TURN_DURATION_IN_SECONDS.default;
}
