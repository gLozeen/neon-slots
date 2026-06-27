export type Phase = string;

export type PhaseHandler = () => Promise<Phase>;
export type WinLine = number[];

export type WinResult = {
  lineIndex: number;
  symbol: string;
  count: number;
};
