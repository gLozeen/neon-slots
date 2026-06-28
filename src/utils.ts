import gsap from "gsap";
import { BitmapText } from "pixi.js";

interface tickUpNumberOptions {
  element: BitmapText;
  targetValue: number;
  duration: number;
  step: number;
  decimals: number;
  ease: string;
}

export function tickUpNumber(options: tickUpNumberOptions) {
  let currentValue = 0;
  const startTime = gsap.ticker.time;
  const easeFn = gsap.parseEase(options.ease);

  function update() {
    const elapsed = gsap.ticker.time - startTime;
    let progress = Math.min(elapsed / options.duration, 1);
    progress = easeFn(progress); // Apply easing

    // Calculate the current value based on progress
    currentValue = progress * options.targetValue;

    // Round to nearest step for discrete changes
    const steppedValue = Math.round(currentValue / options.step) * options.step;

    // Format with fixed decimal places
    const formattedValue = steppedValue.toFixed(options.decimals);

    // Update DOM
    options.element.text = formattedValue;

    // Stop when reaching target
    if (progress >= 1) {
      gsap.ticker.remove(update);
      // Ensure final value is exact
      options.element.text = options.targetValue.toFixed(options.decimals);
    }
  }

  // Add update function to GSAP ticker
  gsap.ticker.add(update);
}
