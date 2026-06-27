import {
  BitmapText,
  Container,
  FederatedPointerEvent,
  Graphics,
  Sprite,
  Texture,
} from "pixi.js";
import { eventBus } from "./ui";
import gsap from "gsap";

interface CheckboxTextures {
  bg: string;
  bg_h: string;
  checkIcon: string;
}
interface CheckBoxOptions {
  label: string;
  eventName: string;
  textures: CheckboxTextures;
  isChecked: boolean;
}

export class CheckBox extends Container {
  private checkBack: Sprite;
  private eventName: string;
  private labelText: string;
  private isChecked: boolean;

  constructor(options: CheckBoxOptions) {
    super();
    this.checkBack = new Sprite(Texture.from("check_box"));
    this.eventName = options.eventName;
    this.labelText = options.label;
    this.label = "check_" + options.eventName;

    this.isChecked = options.isChecked;

    this.interactive = true;

    const checkIcon = new Sprite(Texture.from("check"));
    checkIcon.label = "check icon";
    checkIcon.alpha = 0;
    checkIcon.width = this.checkBack.width - 15;
    checkIcon.height = this.checkBack.height - 15;
    checkIcon.x = this.checkBack.width / 2 - checkIcon.width / 2;
    checkIcon.anchor.set(0, 0.5);

    if (this.isChecked) {
      checkIcon.alpha = 1;
      this.checkBack.addChild(checkIcon);
    }

    this.on("pointerenter", () => {
      this.checkBack.texture = Texture.from("check_box_h");
    });
    this.on("pointerleave", () => {
      this.checkBack.texture = Texture.from("check_box");
    });
    this.on("pointerdown", () => {
      if (this.isChecked) {
        gsap.to(checkIcon, {
          alpha: 0,
          duration: 0.3,
          ease: "power1.out",
          onComplete: () => {
            this.checkBack.removeChild(checkIcon);
            eventBus.emit(this.eventName);
          },
        });
        this.isChecked = false;
      } else {
        gsap.to(checkIcon, { alpha: 1, duration: 0.3, ease: "power1.in" });
        this.checkBack.addChild(checkIcon);
        eventBus.emit(this.eventName);
        this.isChecked = true;
      }
    });
    const label = new BitmapText({
      text: this.labelText,
      style: { fontFamily: "Arial", fontSize: 35 },
    });
    label.x = this.checkBack.x + 50;
    label.y = this.checkBack.y;

    this.addChild(this.checkBack, label);

    label.anchor.set(0, 0.5);
    this.checkBack.anchor.set(0, 0.5);

    this.alpha = 0;
    gsap.to(this, { alpha: 1, duration: 0.5, ease: "power1.out" });
  }
}
interface SliderTextures {
  track: string;
  fill: string;
  thumb: string;
  thumbHover: string;
}

interface SliderOptions {
  eventName: string;
  width: number;
  textures: SliderTextures;
  container: Container;
  currentValue: number;
}

class Slider extends Container {
  private eventName: string;
  private trackStart: Sprite;
  private trackEnd: Sprite;
  private trackRect: Graphics;
  private fill: Sprite;
  private fillRect: Graphics;
  private thumb: Sprite;
  private thumbTexture: Texture;
  private thumbHoverTexture: Texture;
  private dragging = false;
  private sliderWidth: number;
  private container: Container;
  private currentValue: number;

  constructor(options: SliderOptions) {
    super();

    this.container = options.container;
    this.eventName = options.eventName;

    this.label = "slider_" + this.eventName;

    this.currentValue = options.currentValue;

    this.sliderWidth = options.width;

    this.trackStart = new Sprite(Texture.from(options.textures.track));
    this.trackEnd = new Sprite(Texture.from(options.textures.track));

    this.trackStart.anchor.set(0.5, 0);
    this.trackEnd.anchor.set(0.5, 0);
    this.trackEnd.x =
      this.trackStart.x + this.sliderWidth - this.trackStart.width / 2;

    this.trackRect = new Graphics()
      .rect(
        this.trackStart.x,
        0,
        this.sliderWidth - this.trackStart.width / 2,
        this.trackStart.height,
      )
      .fill(0x000000);

    this.fill = new Sprite(Texture.from(options.textures.fill));
    this.fill.anchor.set(0.5, 0);
    this.fill.y =
      this.trackStart.y + (this.trackStart.height - this.fill.height) / 2;

    this.fillRect = new Graphics()
      .rect(this.fill.x, this.fill.y, 1, this.fill.height)
      .fill(0x464646);
    this.fillRect.zIndex = 2;

    this.thumb = new Sprite(Texture.from(options.textures.thumb));

    this.thumbTexture = Texture.from(options.textures.thumb);
    this.thumbHoverTexture = Texture.from(options.textures.thumbHover);

    this.thumb.anchor.set(0.5);
    this.thumb.y = this.trackStart.height / 2;
    this.thumb.interactive = true;
    this.thumb.cursor = "pointer";
    this.thumb.zIndex = 3;

    this.thumb.x = this.sliderWidth * this.currentValue;
    this.fillRect.scale.x = this.thumb.x;

    this.thumb
      .on("pointerover", () => {
        this.thumb.texture = this.thumbHoverTexture;
      })
      .on("pointerout", () => {
        if (!this.dragging) this.thumb.texture = this.thumbTexture;
      })
      .on("pointerdown", () => {
        this.dragging = true;
        this.container.on("pointermove", this.onDragMove.bind(this));
      });

    this.container
      .on("pointerup", () => {
        if (this.dragging) {
          this.dragging = false;
          this.thumb.texture = this.thumbTexture;
          this.container.off("pointermove", this.onDragMove.bind(this));
        }
      })
      .on("pointerupoutside", () => {
        if (this.dragging) {
          this.dragging = false;
          this.thumb.texture = this.thumbTexture;
          this.container.off("pointermove", this.onDragMove.bind(this));
        }
      });

    this.addChild(this.trackStart, this.trackEnd, this, this.trackRect);
    this.addChild(this.fill, this.fillRect);
    this.addChild(this.thumb);
  }

  private onDragMove(event: FederatedPointerEvent) {
    if (!this.dragging) return;

    const local = event.getLocalPosition(this);

    const thumbX = Math.max(0, Math.min(local.x, this.sliderWidth));

    gsap.quickTo(this.thumb, "x", { duration: 0.01, ease: "power1.out" })(
      thumbX,
    );

    this.fillRect.scale.x = this.thumb.x;

    eventBus.emit(this.eventName, { volume: this.thumb.x / this.sliderWidth });
  }
}

export class SliderContainer extends Container {
  private slider: Slider;
  private labelText: BitmapText;
  constructor(label: string, sliderOptions: SliderOptions) {
    super();
    this.slider = new Slider(sliderOptions);
    console.log("Slider:", this.slider, sliderOptions);
    this.labelText = new BitmapText({
      text: label,
      style: {
        fontFamily: "Arial",
        fontSize: 35,
      },
    });
    this.labelText.anchor.set(0.5);
    this.labelText.x = this.slider.x - this.labelText.width / 1.5;
    this.labelText.y = this.height / 2 + 12;
    this.addChild(this.labelText, this.slider);
  }
}
