import type { SlideLayout } from "../types.ts";
import type { CarouselTemplateInput } from "./types.ts";
import { renderBaseTemplate } from "./base.ts";
import { renderHookCoverTemplate } from "./hook-cover.ts";
import { renderProblemSetupTemplate } from "./problem-setup.ts";
import { renderRecipeCardTemplate } from "./recipe-card.ts";
import { renderCtaBannerTemplate } from "./cta-banner.ts";

export type TemplateFn = (input: CarouselTemplateInput) => string;

/**
 * Routes a slide to the correct template function based on its layout.
 * Falls back to a thin adapter around renderBaseTemplate for legacy layouts.
 */
export function selectTemplate(slideLayout: SlideLayout): TemplateFn {
  switch (slideLayout) {
    case "hook_cover":
      return renderHookCoverTemplate;
    case "problem_setup":
      return renderProblemSetupTemplate;
    case "recipe_card":
      return renderRecipeCardTemplate;
    case "cta_banner":
      return renderCtaBannerTemplate;
    // Legacy layouts — adapt CarouselTemplateInput to SlideTemplateInput
    case "hook":
    case "statement":
    case "image_text_split":
    case "image_focus":
    case "cta":
    default:
      return (input: CarouselTemplateInput) =>
        renderBaseTemplate({
          slide: input.slide,
          productName: input.productName,
          imageDataUrl: input.imageDataUrl,
        });
  }
}
