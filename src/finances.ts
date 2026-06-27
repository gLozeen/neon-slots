import { makeAutoObservable } from "mobx";

export class Finances {
  totalBet: number;
  betAmount: number;
  balance: number;

  constructor() {
    makeAutoObservable(this);
    this.totalBet = 0;
    this.betAmount = 1;
    this.balance = 1000;
  }
  tapHandler() {
    this.totalBet += this.betAmount;

    this.balance -= this.betAmount;
  }
  setBetAmount(newBet: number) {
    if (newBet > 0) this.betAmount = newBet;
  }
}
export const finances = new Finances();
