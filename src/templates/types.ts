import type { Slide, BrandVisualSettings } from "../types.ts";

export interface CarouselTemplateInput {
  slide: Slide;
  productName: string;
  imageDataUrl: string | null;
  brandVisual: BrandVisualSettings;
  slideCount: number;
}
