import { CRTFilter } from "pixi-filters";
import {
  type ReelSet,
  ReelSetBuilder,
  SpeedPresets,
  type Win,
  WinPresenter,
} from "pixi-reels";
import {
  Application,
  Assets,
  BitmapText,
  groupD8,
  Texture,
} from "pixi.js";
import type { Phase, PhaseHandler } from "./types";
import { autorun, makeAutoObservable } from "mobx";
import { SlotMath, PAYLINES } from "./slot-math";
import { finances } from "./finances";
import { CONFIG } from "./config";
import { find, tickUpNumber } from "./utils";
import { MySymbol } from "./my-symbol";
import { mountHud, type BootedHud } from "@open-slot-ui/pixi";
export class Slot {
  private app?: Application;
  private hud?: BootedHud;
  private _idleResolve?: () => void;

  private backgroundMusic: HTMLAudioElement = new Audio(
    "assets/sounds/main_ambient.mp3",
  );

  private result?: string[][];

  private reelSet?: ReelSet;

  private winPresenter?: WinPresenter;

  private phases: Record<Phase, PhaseHandler> = {
    load: async () => {
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
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        view: document.getElementById("pixi-container")! as HTMLCanvasElement,
      });

      console.log(finances.betAmount);

      this.backgroundMusic.loop = true;

      const betButtonIcon: Texture = await Assets.load(
        "assets/ui/bet-button.webp",
      );
      const autoplayButton = await Assets.load("assets/ui/autospin-btn.webp");
      const betPlusIcon = new Texture({
        source: betButtonIcon.source,
        frame: betButtonIcon.frame,
        rotate: groupD8.W,
      });

      this.hud = mountHud(
        this.app,
        {
          turbo: { modes: 2 },
          autoplay: { mode: "options" },
          spin: { press: "hold-to-spin" },
          betLadder: { levels: [1, 2, 5, 10, 20], index: 1 },

        },
        {
          icons: {
            betPlus: betPlusIcon,
            betMinus: betButtonIcon,
            autoIdle: autoplayButton
          },
        },
      );

      this.hud.on("spinRequested", () => {
        finances.goForSpin();
        this._idleResolve?.();
        this._idleResolve = undefined;
      });


      this.hud.on("autoplayStarted", () => {
        finances.goForSpin();
        this._idleResolve?.();
        this._idleResolve = undefined;
      });

      this.hud.on("buttonActivated", ({ id }) => {
        if (id === "bet-plus") finances.setBetAmount(finances.betAmount + 1);
        if (id === "bet-minus") finances.setBetAmount(finances.betAmount - 1);
        if(id == "mute") this.muteMusic();
      });

      this.hud.on("turboChanged", ({ mode }) => {
        this.reelSet?.setSpeed(mode === "off"? "normal": "turbo");
      });

      // Mobile fix: a touch tap that opens the settings panel also triggers a
      // trailing synthetic "click" (browsers fire this for compatibility since
      // the HUD button never calls preventDefault on pointerdown/up). That click
      // lands on the now-visible backdrop and closes the panel instantly. Swallow
      // the one click that follows an open.
      this.hud.on("panelToggled", ({ id, open }) => {
        if (id !== "settings-panel" || !open) return;
        const swallowGhostClick = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
        };
        document.addEventListener("click", swallowGhostClick, {
          capture: true,
          once: true,
        });
        setTimeout(
          () => document.removeEventListener("click", swallowGhostClick, true),
          400,
        );
      });

      this.hud.on("valueChanged", ({id, value})=>{
        if(id === "music") this.setMusicVolume(value);
      })

      autorun(() => {
        this.hud!.setBalance(finances.balance);
        this.hud!.setBet(finances.betAmount);
      });

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
        if (this.hud) 
          this.hud.ui.musicSlider.setNormalized(this.backgroundMusic.volume)
      } catch (err) {
        console.log(err);
        this.backgroundMusic.volume = 0.5;
      }
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
          r.register("star", MySymbol, {
            textures: { star: star },
          });
          r.register("seven", MySymbol, {
            textures: { seven: seven },
          });
          r.register("bar", MySymbol, {
            textures: { bar: bar },
          });
        })
        .ticker(this.app.ticker)
        .symbolGap(10, 10)
        .build();
      
      this.reelSet.speed.addProfile('turbo', SpeedPresets.TURBO);
        

      const REEL_W = CONFIG.reelAmount * CONFIG.symbolWidth;
      const REEL_H = CONFIG.rowAmount * CONFIG.symbolHeight;
      const UI_BAR_H = CONFIG.ui_bar_h;
      const REEL_MARGIN = CONFIG.reelMargin;

      const layoutReelSet = () => {
        const availableW = this.app!.screen.width - REEL_MARGIN * 2;
        const availableH =
          this.app!.screen.height - UI_BAR_H - REEL_MARGIN * 2;
        const scale = Math.min(
          availableW / REEL_W,
          availableH / REEL_H,
          CONFIG.scale,
        );
        this.reelSet!.scale.set(scale);
        this.reelSet!.x = (this.app!.screen.width - REEL_W * scale) / 2;
        this.reelSet!.y =
          (this.app!.screen.height - REEL_H * scale - UI_BAR_H) / 2;
      };

      this.app.stage.addChild(this.reelSet);
      layoutReelSet();

      window.addEventListener("resize", () => {
        this.app!.renderer.resize(window.innerWidth, window.innerHeight);
        layoutReelSet();
      });

      this.winPresenter = new WinPresenter(this.reelSet, {
        stagger: 200,
        dimLosers: true,
        cycles: 1,
      });

      return "idle";
    },
    idle: async () => {
      if (this.hud?.ui.autoplay.isActive) {
        finances.goForSpin();
        return "spin";
      }
      await new Promise<void>((resolve) => {
        this._idleResolve = resolve;
      });
      return "spin";
    },
    spin: async () => {
      const found = find(this.app!.stage, "winAmount");
      if (found) this.app!.stage.removeChild(found);

      this.hud!.ui.spin.busy();
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
          resolve();
        });
      });
      this.hud!.ui.spin.idle();
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
        winAmount.y =
          this.reelSet!.y + this.reelSet!.height + CONFIG.winAmountGap;
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
      this.hud!.reportRound(totalWin, finances.betAmount);
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
  muteMusic(){
    try{
    let prevValue = 0;
    return (()=>{
      if(prevValue == 0){
        prevValue = this.backgroundMusic.volume;
        this.setMusicVolume(0);
      } else {
        this.setMusicVolume(prevValue);
        prevValue = 0;
      }
    })
    }catch(err){
      console.log(err);
      return this.backgroundMusic.volume;
    }
  }
}
