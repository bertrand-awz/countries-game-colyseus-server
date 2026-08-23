export class TurnManager {
    private readonly turnOrder: string[] = [];
    private currentTurnIndex: number = 0;

    addPlayer(playerSessionId: string): void {
        if (this.turnOrder.includes(playerSessionId)) {
            return;
        }

        this.turnOrder.push(playerSessionId);

        if (this.turnOrder.length === 1) {
            this.currentTurnIndex = 0;
        }
    }

    removePlayer(playerSessionId: string): void {
        const playerIndex = this.turnOrder.indexOf(playerSessionId);

        if (playerIndex === -1) {
            return;
        }

        const wasBeforeCurrentPlayer = playerIndex < this.currentTurnIndex;
        const wasCurrentPlayer = playerIndex === this.currentTurnIndex;

        this.turnOrder.splice(playerIndex, 1);

        if (this.turnOrder.length === 0) {
            this.currentTurnIndex = 0;
            return;
        }

        if (wasBeforeCurrentPlayer) {
            this.currentTurnIndex--;
        }

        if (wasCurrentPlayer && this.currentTurnIndex >= this.turnOrder.length) {
            this.currentTurnIndex = 0;
        }
    }

    isCurrentPlayer(playerSessionId: string): boolean {
        return this.getCurrentPlayerId() === playerSessionId;
    }

    getCurrentPlayerId(): string {
        if (this.turnOrder.length === 0) {
            return "";
        }

        return this.turnOrder[this.currentTurnIndex];
    }

    nextTurn(): string {
        if (this.turnOrder.length === 0) {
            this.currentTurnIndex = 0;
            return "";
        }

        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;

        return this.getCurrentPlayerId();
    }

    resetTurn(): void {
        this.currentTurnIndex = 0;
    }

    hasPlayers(): boolean {
        return this.turnOrder.length > 0;
    }

    getPlayerCount(): number {
        return this.turnOrder.length;
    }
}
