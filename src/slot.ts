import { CRTFilter } from "pixi-filters";
import {
  ReelSet,
  ReelSetBuilder,
  SpriteSymbol,
  Win,
  WinPresenter,
} from "pixi-reels";
import { Text, Application, Assets, BitmapText } from "pixi.js";
import { eventBus, EVENTS, find } from "./ui";
import { Phase, PhaseHandler } from "./types";
import { manifest } from "./assets";
import { autorun, makeAutoObservable } from "mobx";
import { SlotMath, PAYLINES } from "./slotMath";
import { finances } from "./finances";
import { CONFIG } from "./config";
import { tickUpNumber } from "./utils";

export class Slot {
  private app?: Application;

  private backgroundMusic: HTMLAudioElement = new Audio(
    "assets/sounds/main_ambient.mp3",
  );

  private autoplayActive: boolean = false;

  private result?: string[][];

  private reelSet?: ReelSet;

  private winPresenter?: WinPresenter;

  private phases: Record<Phase, PhaseHandler> = {
    load: async () => {
      await Assets.init({ manifest: manifest });
      await Assets.loadBundle(["ui"]);
      return "init";
    },
    init: async () => {
      this.app = new Application();
      await this.app.init({
        background: "#040f03",
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0,
        antialias: true,
        view: document.getElementById("pixi-container")! as HTMLCanvasElement,
      });

      this.backgroundMusic.loop = true;

      document.addEventListener(
        "click",
        () => {
          this.backgroundMusic.play();
        },
        { once: true },
      );
      try {
        this.backgroundMusic.volume = parseFloat(
          window.localStorage.getItem("musicVolume")!,
        );
      } catch (err) {
        console.log(err);
        this.backgroundMusic.volume = 0.5;
      }
      eventBus.emit(EVENTS.UI_INIT, {
        app: this.app,
        gameInfo: `you need to hit "SPIN" and win!`,
        settingOptions: [
          {
            type: "slider",
            label: "Volume",
            value: this.getMusicVolume(),
            eventName: "volume_change",
          },
        ],
      });

      eventBus.on("volume_change", (message) => {
        this.setMusicVolume(message.volume);
      });

      let wasActive = false;

      eventBus.on(EVENTS.autoplay, () => {
        this.setAutoplayActive(this.autoplayActive ? false : true);
        wasActive = this.autoplayActive;
      });

      eventBus.on(EVENTS.backgroundInactive, () => {
        this.setAutoplayActive(wasActive);
      });
      const crtFilter = new CRTFilter({
        lineWidth: 2,
        lineContrast: 0.3,
        verticalLine: false,
        noise: 0.05,
        vignetting: 0.4,
        vignettingAlpha: 0.8,
        vignettingBlur: 0.3,
        curvature: 1,
      });

      this.app.stage.filters = [crtFilter];

      let time = 0;
      this.app.ticker.add((tick) => {
        time += 0.5 * tick.deltaMS;
        crtFilter.time = time;
      });

      const star = await Assets.load("assets/star.png");
      const seven = await Assets.load("assets/seven.png");
      const bar = await Assets.load("assets/bar.png");

      this.reelSet = new ReelSetBuilder()
        .reels(CONFIG.reelAmount)
        .visibleRows(CONFIG.rowAmount)
        .symbolSize(CONFIG.symbolWidth, CONFIG.symbolHeight)
        .symbols((r) => {
          r.register("star", SpriteSymbol, { textures: { star: star } });
          r.register("seven", SpriteSymbol, { textures: { seven: seven } });
          r.register("bar", SpriteSymbol, { textures: { bar: bar } });
        })
        .ticker(this.app.ticker)
        .build();

      const REEL_W = CONFIG.reelAmount * CONFIG.symbolWidth;
      const REEL_H = CONFIG.rowAmount * CONFIG.symbolHeight;
      const UI_BAR_H = CONFIG.ui_bar_h;

      const centerReelSet = () => {
        this.reelSet!.x = (this.app!.screen.width - REEL_W) / 2;
        this.reelSet!.y = (this.app!.screen.height - REEL_H - UI_BAR_H) / 2;
      };

      this.app.stage.addChild(this.reelSet);
      centerReelSet();

      window.addEventListener("resize", () => {
        this.app!.renderer.resize(window.innerWidth, window.innerHeight);
        centerReelSet();
      });

      this.winPresenter = new WinPresenter(this.reelSet, {
        stagger: 200,
        dimLosers: true,
        cycles: 1,
      });

      autorun(() => {
        document.getElementById("balanceAmount")!.innerText =
          finances.balance.toString();
        document.getElementById("betAmount")!.innerText =
          finances.betAmount.toString();
      });

      return "idle";
    },
    idle: async () => {
      await new Promise<void>((resolve) => {
        eventBus.on(EVENTS.spin, () => {
          finances.goForSpin();
          resolve();
        });
        eventBus.on(EVENTS.buttonUp, () => {
          finances.setBetAmount(finances.betAmount + 1);
        });
        eventBus.on(EVENTS.buttonDown, () => {
          finances.setBetAmount(finances.betAmount - 1);
        });
      });
      return "spin";
    },
    spin: async () => {
      const found = find(this.app!.stage, "winAmount");
      if (found) this.app!.stage.removeChild(found);
      this.winPresenter!.abort();
      this.result = SlotMath.generateGrid(5, 3);
      this.reelSet!.spin();
      setTimeout(() => {
        if (this.result)
          this.reelSet!.setResult([
            { visible: this.result[0] },
            { visible: this.result[1] },
            { visible: this.result[2] },
            { visible: this.result[3] },
            { visible: this.result[4] },
          ]);
      }, 500);
      await new Promise<void>((resolve) => {
        this.reelSet!.events.on("spin:complete", () => {
          eventBus.emit(EVENTS.spinComplete, {});
          resolve();
        });
      });
      return "results";
    },
    results: async () => {
      const winAmount = new BitmapText({
        text: "0",
        style: {
          fill: "#ffffff",
          fontSize: 36,
        },
      });
      winAmount.label = "winAmount";
      winAmount.anchor = 0.5;

      const winResult = SlotMath.calculateWins(this.result!);
      const wins: Win[] = winResult.map((w) => ({
        cells: Array.from({ length: w.count }, (_, r) => ({
          reelIndex: r,
          rowIndex: PAYLINES[w.lineIndex][r],
        })),
      }));
      const totalWin = SlotMath.calculatePayout(winResult, finances.betAmount);
      if (totalWin > 0) {
        finances.addWin(totalWin);

        this.winPresenter!.show(wins);
        winAmount.x = this.reelSet!.x + this.reelSet!.width / 2;
        winAmount.y = this.reelSet!.y + this.reelSet!.height + 20;
        this.app!.stage.addChild(winAmount);
        tickUpNumber({
          element: winAmount,
          targetValue: totalWin,
          duration: 2,
          step: 0.01,
          decimals: 2,
          ease: "power2.out",
        });
      }
      return "idle";
    },
  };
  constructor() {
    makeAutoObservable(this);

    this.execute("load");
  }

  async execute(phase: Phase) {
    console.groupEnd();
    console.group(`Phase ${phase}`);
    const nextPhase: Phase = await this.phases[phase]();
    this.execute(nextPhase);
  }
  setMusicVolume(value: number) {
    try {
      window.localStorage.setItem("musicVolume", value.toString());
      this.backgroundMusic.volume = value;
    } catch (err) {
      console.log(err);
      this.backgroundMusic.volume = value;
    }
  }
  getMusicVolume() {
    try {
      if (isNaN(parseFloat(window.localStorage.getItem("musicVolume")!)))
        throw "No local storage";
      return parseFloat(window.localStorage.getItem("musicVolume")!);
    } catch (err) {
      console.log(err);
      return this.backgroundMusic.volume;
    }
  }

  setAutoplayActive(value: boolean) {
    this.autoplayActive = value;
  }
}
