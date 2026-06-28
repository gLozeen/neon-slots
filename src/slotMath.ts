import type { WinLine, WinResult } from "./types";

export const PAYLINES: WinLine[] = [
  [1, 1, 1, 1, 1], // middle row
  [0, 0, 0, 0, 0], // top row
  [2, 2, 2, 2, 2], // bottom row
  [0, 1, 2, 1, 0], // V-shape
  [2, 1, 0, 1, 2], // inverted V
  [0, 0, 1, 2, 2], // diagonal down-right
  [2, 2, 1, 0, 0], // diagonal up-right
  [1, 0, 0, 0, 1], // top arch
  [1, 2, 2, 2, 1], // bottom arch
];
export class SlotMath {
  static symbols: string[] = ["star", "bar", "seven"];
  static weights: number[] = [30, 15, 5];

  static payouts: Record<string, Record<number, number>> = {
    star: { 3: 2, 4: 5, 5: 10 },
    bar: { 3: 5, 4: 20, 5: 50 },
    seven: { 3: 25, 4: 100, 5: 500 },
  };

  static calculatePayout(wins: WinResult[], betAmount: number): number {
    return wins.reduce((total, w) => {
      const multiplier = SlotMath.payouts[w.symbol]?.[w.count] ?? 0;
      return total + betAmount * multiplier;
    }, 0);
  }

  static weightedRandom(): string {
    const total = SlotMath.weights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < SlotMath.symbols.length; i++) {
      r -= SlotMath.weights[i];
      if (r <= 0) return SlotMath.symbols[i];
    }
    return SlotMath.symbols[SlotMath.symbols.length - 1];
  }

  static generateGrid(reels: number, rows: number): string[][] {
    return Array.from({ length: reels }, () =>
      Array.from({ length: rows }, () => SlotMath.weightedRandom()),
    );
  }

  static calculateWins(
    grid: string[][],
    lines: WinLine[] = PAYLINES,
  ): WinResult[] {
    const wins: WinResult[] = [];

    lines.forEach((line, lineIndex) => {
      const firstSymbol = grid[0][line[0]];
      let count = 1;

      for (let reel = 1; reel < grid.length; reel++) {
        if (grid[reel][line[reel]] === firstSymbol) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 3) {
        wins.push({ lineIndex, symbol: firstSymbol, count });
      }
    });

    return wins;
  }
}
