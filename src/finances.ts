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
  setBetAmount(newBet: number) {
    if (newBet > 0) this.betAmount = newBet;
  }
  goForSpin() {
    this.balance = this.balance - this.betAmount;
  }
  addWin(amount: number) {
    this.balance = this.balance + amount;
  }
}
export const finances = new Finances();
