import type { CarouselTemplateInput } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderRecipeCardTemplate(input: CarouselTemplateInput): string {
  const { slide, brandVisual, imageDataUrl, slideCount } = input;
  const { primaryColor, secondaryColor } = brandVisual;
  const font = brandVisual.fontFamily ?? "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  const recipe = slide.recipe;

  const recipeName = escapeHtml(recipe?.recipeName ?? "Recipe");
  const cookTime = recipe?.cookTime ? escapeHtml(recipe.cookTime) : "";
  const cost = recipe?.cost ? escapeHtml(recipe.cost) : "";

  // Subtext — one short line about what makes it appealing
  const proTip = recipe?.proTip ? escapeHtml(recipe.proTip) : "";

  // Full-bleed food image
  const bgImage = imageDataUrl
    ? `<img src="${imageDataUrl}" alt="" style="position:absolute;top:0;left:0;width:1080px;height:1080px;object-fit:cover;z-index:0;" />`
    : `<div style="position:absolute;top:0;left:0;width:1080px;height:1080px;background:${secondaryColor};z-index:0;"></div>`;

  // Small metadata footer
  const metaParts: string[] = [];
  if (cookTime) metaParts.push(cookTime);
  if (cost) metaParts.push(cost);
  const metaLine = metaParts.length > 0
    ? `<div style="font-size:20px;color:rgba(255,255,255,0.7);font-weight:500;margin-top:10px;letter-spacing:0.03em;">${metaParts.join("  /  ")}</div>`
    : "";

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:8px;height:8px;border-radius:50%;background:${i === slide.slide_number - 1 ? '#fff' : 'rgba(255,255,255,0.35)'};"></div>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:${font};position:relative;background:#000;">
  <!-- Full-bleed food image -->
  ${bgImage}

  <!-- Gradient mask at bottom for text readability -->
  <div style="position:absolute;bottom:0;left:0;width:1080px;height:420px;background:linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.8) 100%);z-index:1;"></div>

  <!-- Text overlay — minimal, on the image -->
  <div style="position:absolute;bottom:44px;left:48px;right:48px;z-index:2;">
    <!-- Dish name -->
    <div style="font-size:44px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;line-height:1.1;text-shadow:0 2px 16px rgba(0,0,0,0.3);">${recipeName}</div>

    <!-- Short descriptor -->
    ${proTip ? `<div style="font-size:22px;color:rgba(255,255,255,0.85);font-weight:500;margin-top:8px;line-height:1.4;">${proTip}</div>` : ""}

    <!-- Metadata -->
    ${metaLine}
  </div>

  <!-- Dots -->
  <div style="position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:2;">${dots}</div>
</body>
</html>`;
}
