import gsap from "gsap";
import {
  Application,
  BitmapText,
  Container,
  EventEmitter,
  Graphics,
} from "pixi.js";
import { CheckBox, SliderContainer } from "./ui-components";

export function find(container: Container, toFind: string) {
  return container.children.find((child) => child.label == toFind);
}

export const ui_bundle = {
  name: "ui",
  assets: [
    {
      alias: "bar_bg",
      src: "/assets/ui/bar-bg.webp",
    },
    {
      alias: "bar_fill",
      src: "/assets/ui/bar-fill.webp",
    },
    {
      alias: "bar_cap",
      src: "/assets/ui/bar-cap.webp",
    },
    {
      alias: "bar_cap_h",
      src: "/assets/ui/bar-cap-h.webp",
    },
    {
      alias: "check_box",
      src: "assets/ui/check-box.webp",
    },
    {
      alias: "check_box_p",
      src: "assets/ui/check-box-p.webp",
    },
    {
      alias: "check_box_h",
      src: "assets/ui/check-box-h.webp",
    },
    {
      alias: "check",
      src: "assets/ui/check.webp",
    },
  ],
};
export enum EVENTS {
  info = "btnInfoClick",
  settings = "btnSettingsClick",
  buttonUp = "btnButtonUpClick",
  buttonDown = "btnButtonDownClick",
  autoplay = "btnAutoplayClick",
  spin = "btnSpinClick",
  backgroundActive = "backgroundActive",
  backgroundInactive = "backgroundInactive",
  UI_INIT = "UI_INIT",
  spinStart = "spinStart",
  spinComplete = "spinComplete",
}

type settingOptions = {
  type: "check" | "slider";
  label: string;
  eventName: string;
  value?: number | boolean;
};

type setupUiOptions = {
  app: Application;
  gameInfo: string;
  settingOptions: [settingOptions];
};

export const eventBus = new EventEmitter<string, EVENTS>();

const setAnimations = (id: string, newSrc: string) => {
  const element = document.getElementById(id)! as HTMLImageElement;
  const tlHover = gsap.timeline({ paused: true });
  const tlDown = gsap.timeline({ paused: true });
  const oldSrc = element.src;
  tlHover.to(element, {
    scale: 1.1,
    duration: 0.3,
    ease: "power2.inOut",
  });
  tlDown.to(element, {
    scale: 1,
    duration: 0.3,
    ease: "power2.in",
  });

  element.addEventListener("mouseenter", () => {
    tlHover.play();
    element.src = newSrc + "-h.webp";
  });
  element.addEventListener("mouseleave", () => {
    tlHover.reverse();
    element.src = oldSrc;
  });
  element.addEventListener("mousedown", () => {
    tlDown.play();
    element.src = newSrc + "-p.webp";
    eventBus!.emit(EVENTS[id as keyof typeof EVENTS], { message: element });
  });
  element.addEventListener("mouseup", () => {
    tlDown.reverse();
    element.src = newSrc + "-h.webp";
  });
};

const setButtonWithBusyState = (
  id: string,
  baseSrc: string,
  startEvent: string,
  endEvent: string,
) => {
  const element = document.getElementById(id)! as HTMLImageElement;
  const normalSrc = baseSrc + ".webp";
  const pressedSrc = baseSrc + "-p.webp";
  const hoverSrc = baseSrc + "-h.webp";
  let busy = false;

  const tlHover = gsap.timeline({ paused: true });
  const tlDown = gsap.timeline({ paused: true });

  tlHover.to(element, { scale: 1.1, duration: 0.3, ease: "power2.inOut" });
  tlDown.to(element, { scale: 1, duration: 0.3, ease: "power2.in" });

  element.addEventListener("mouseenter", () => {
    if (busy) return;
    tlHover.play();
    element.src = hoverSrc;
  });
  element.addEventListener("mouseleave", () => {
    if (busy) return;
    tlHover.reverse();
    element.src = normalSrc;
  });
  element.addEventListener("mousedown", () => {
    if (busy) return;
    tlDown.play();
    element.src = pressedSrc;
    eventBus.emit(EVENTS[id as keyof typeof EVENTS], { message: element });
  });
  element.addEventListener("mouseup", () => {
    if (busy) return;
    tlDown.reverse();
    element.src = hoverSrc;
  });

  eventBus.on(startEvent, () => {
    busy = true;
    element.style.cursor = "not-allowed";
    element.src = pressedSrc;
  });

  eventBus.on(endEvent, () => {
    busy = false;
    element.style.cursor = "";
    element.src = normalSrc;
  });
};

const setSettings = (
  container: Container,
  settingOptions: [settingOptions],
  mainX: number,
) => {
  const gap = 20;
  const padding = 150;

  let currentHeight = padding;
  settingOptions.map((option: settingOptions) => {
    if (option.type == "check") {
      const element = new CheckBox({
        label: option.label,
        eventName: option.eventName,
        isChecked: option.value!.valueOf() as boolean,
        textures: {
          bg: "check-box",
          bg_h: "check-box-h",
          checkIcon: "check",
        },
      });
      element.x = mainX;
      element.y = currentHeight + gap;
      container.addChild(element);
      currentHeight += element.height + gap;
    }
    if (option.type == "slider") {
      const isNumber = typeof option.value!.valueOf() == "number";
      const slider = new SliderContainer(option.label, {
        container: container,
        eventName: option.eventName,
        currentValue: isNumber ? (option.value!.valueOf() as number) : 1,
        width: 400,
        textures: {
          track: "bar_bg",
          fill: "bar_fill",
          thumb: "bar_cap",
          thumbHover: "bar_cap_h",
        },
      });

      slider.x = mainX;
      slider.y = currentHeight + gap;

      container.addChild(slider);
      currentHeight += slider.height + gap;
    }
  });
};

eventBus.on(EVENTS.UI_INIT, (options: setupUiOptions) => {
  console.log("Screen width:", options.app.screen.width);
  let currentlyOpened: string;

  const uiContainer = document.getElementById("uiContainer")!;
  const resizeUi = () => {
    uiContainer.style.width =
      window.innerWidth - window.innerWidth * 0.02 + "px";
  };
  resizeUi();
  window.addEventListener("resize", resizeUi);

  eventBus.on(
    EVENTS.backgroundActive,
    (message: { alpha: string; duration: number; ease: string }) => {
      const container = document.getElementById("uiContainer")!;
      console.log(container);
      container.style.pointerEvents = "none";
      gsap.to(container, message);
    },
  );
  eventBus.on(
    EVENTS.backgroundInactive,
    (message: { alpha: string; duration: number; ease: string }) => {
      const container = document.getElementById("uiContainer")!;
      console.log(container);
      container.style.pointerEvents = "all";
      gsap.to(container, message);
    },
  );

  eventBus.on(EVENTS.info, (_message: HTMLElement) => {
    const background = new Graphics();
    background
      .rect(0, 0, options.app.screen.width, options.app.screen.height)
      .fill({ color: 0x071c06, alpha: 1 });
    background.eventMode = "static";
    background.alpha = 0;

    console.log(_message);

    const textContainer = new BitmapText({
      text: options.gameInfo,
      style: {
        fontFamily: "Arial",
        fontSize: 35,
      },
    });
    textContainer.x = background.width / 2;
    textContainer.y = background.height / 2;
    textContainer.anchor.set(0.5);
    textContainer.label = "info main_text";
    const labelContainer = new BitmapText({
      text: "Informations",
      style: {
        fontFamily: "Arial",
        fontSize: 80,
      },
    });
    labelContainer.x = background.width / 2;
    labelContainer.y = 100;
    labelContainer.anchor.set(0.5);

    background.label = "background";
    background.addChild(textContainer);
    background.addChild(labelContainer);

    const found = find(options.app.stage, "background");
    console.log(currentlyOpened, background);
    if (found) {
      gsap.to(found, {
        alpha: 0,
        duration: currentlyOpened === EVENTS.info ? 0.5 : 0.3,
        ease: "power1.in",
        onComplete: () => {
          if (currentlyOpened !== EVENTS.info) {
            options.app.stage.addChild(background);
            gsap.to(background, {
              alpha: 1,
              duration: 0.3,
              ease: "power1.out",
            });
            currentlyOpened = EVENTS.info;
          }

          options.app.stage.removeChild(found);
        },
      });
    } else {
      options.app.stage.addChild(background);
      gsap.to(background, { alpha: 1, duration: 0.5, ease: "power1.out" });
      currentlyOpened = EVENTS.info;
    }
  });
  eventBus.on(EVENTS.settings, (_message: HTMLElement) => {
    console.log(_message);
    const found = find(options.app.stage, "background");
    const background = new Graphics();
    background
      .rect(0, 0, options.app.screen.width, options.app.screen.height)
      .fill({ color: 0x071c06, alpha: 1 });
    background.eventMode = "static";
    background.alpha = 0;
    background.label = "background";
    const labelContainer = new BitmapText({
      text: "Settings",
      style: {
        fontFamily: "Arial",
        fontSize: 80,
      },
    });
    labelContainer.x = background.width / 2;
    labelContainer.y = 100;
    labelContainer.anchor.set(0.5);
    background.addChild(labelContainer);

    if (found) {
      gsap.to(found, {
        alpha: 0,
        duration: currentlyOpened === EVENTS.settings ? 0.5 : 0.3,
        ease: "power1.in",
        onComplete: () => {
          if (currentlyOpened !== EVENTS.settings) {
            options.app.stage.addChild(background);

            setSettings(
              background,
              options.settingOptions,
              labelContainer.x - labelContainer.width / 2,
            );
            gsap.to(background, {
              alpha: 1,
              duration: 0.3,
              ease: "power1.out",
            });
            currentlyOpened = EVENTS.settings;
          }
          options.app.stage.removeChild(found);
        },
      });
    } else {
      options.app.stage.addChild(background);

      setSettings(
        background,
        options.settingOptions,
        labelContainer.x - labelContainer.width / 2,
      );
      gsap.to(background, {
        alpha: 1,
        duration: 0.5,
        ease: "power1.out",
      });

      currentlyOpened = EVENTS.settings;
    }
  });

  options.settingOptions.forEach((option) => {
    if (option.type === "slider") {
      eventBus.on(option.eventName, (data: { volume: number }) => {
        option.value = data.volume;
      });
    }
  });

  eventBus.on("btnSpinClick", () => {
    const background = new Graphics();
    background
      .rect(0, 0, options.app.screen.width, options.app.screen.height)
      .fill({ color: 0x071c06, alpha: 1 });
    background.eventMode = "static";
    background.alpha = 0;

    const found = find(options.app.stage, "background");
    console.log("sex", found);
    if (found) {
      if (currentlyOpened) {
        gsap.to(found, {
          alpha: 0,
          duration: 0.3,
          ease: "power1.in",
          onComplete: () => {
            console.log("sex");
            options.app.stage.removeChild(found);
          },
        });
      }
    }
  });

  setAnimations("info", "assets/ui/info-btn");
  setAnimations("settings", "assets/ui/settings-btn");
  setAnimations("buttonUp", "assets/ui/bet-button");
  setAnimations("buttonDown", "assets/ui/bet-button");
  setAnimations("autoplay", "assets/ui/autospin-btn");
  setButtonWithBusyState(
    "spin",
    "assets/ui/spin-btn",
    EVENTS.spinStart,
    EVENTS.spinComplete,
  );
});
