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
  const { primaryColor, secondaryColor, accentColor, surfaceColor } = brandVisual;
  const recipe = slide.recipe;

  const recipeName = escapeHtml(recipe?.recipeName ?? slide.text ?? "Recipe");
  const ingredients = recipe?.ingredients ?? [];
  const steps = recipe?.steps ?? [];
  const cookTime = escapeHtml(recipe?.cookTime ?? "");
  const serves = escapeHtml(recipe?.serves ?? "");
  const cost = escapeHtml(recipe?.cost ?? "");
  const proTip = recipe?.proTip ? escapeHtml(recipe.proTip) : "";

  // Header text from slide.text (e.g. "🍳 RECIPE 1: CLASSIC FRENCH TOAST")
  const headerText = escapeHtml(slide.text ?? recipeName);

  const imgSection = imageDataUrl
    ? `<img src="${imageDataUrl}" alt="" style="width:1080px;height:430px;object-fit:cover;display:block;" />`
    : `<div style="width:1080px;height:430px;background:linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%);display:flex;align-items:center;justify-content:center;">
        <span style="font-size:120px;">🍽️</span>
      </div>`;

  // Badges row
  const badges: string[] = [];
  if (cookTime) badges.push(`⏱️ ${cookTime}`);
  if (serves) badges.push(`👤 Serves: ${serves}`);
  if (cost) badges.push(`💰 ~${cost}`);
  const badgesHtml = badges.length > 0
    ? `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
        ${badges.map((b) => `<span style="background:${accentColor};color:${primaryColor};font-size:24px;font-weight:600;padding:6px 16px;border-radius:20px;">${b}</span>`).join("\n        ")}
      </div>`
    : "";

  // Ingredients list
  const ingredientsHtml = ingredients.length > 0
    ? `<div style="margin-bottom:14px;">
        <div style="font-size:24px;font-weight:800;color:${primaryColor};margin-bottom:8px;letter-spacing:0.05em;">INGREDIENTS:</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px 24px;">
          ${ingredients.map((ing) => `<div style="font-size:22px;color:#333;line-height:1.5;width:calc(50% - 12px);">• ${escapeHtml(ing)}</div>`).join("\n          ")}
        </div>
      </div>`
    : "";

  // Method steps
  const stepsHtml = steps.length > 0
    ? `<div style="margin-bottom:14px;">
        <div style="font-size:24px;font-weight:800;color:${primaryColor};margin-bottom:8px;letter-spacing:0.05em;">METHOD:</div>
        ${steps.map((step, i) => `<div style="font-size:22px;color:#333;line-height:1.5;margin-bottom:4px;"><span style="font-weight:700;color:${secondaryColor};">${i + 1}.</span> ${escapeHtml(step)}</div>`).join("\n        ")}
      </div>`
    : "";

  // Pro tip
  const proTipHtml = proTip
    ? `<div style="font-size:22px;color:${secondaryColor};font-weight:600;margin-top:8px;">💡 Pro tip: ${proTip}</div>`
    : "";

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:10px;height:10px;border-radius:50%;background:${i === slide.slide_number - 1 ? secondaryColor : "rgba(0,0,0,0.2)"};"></div>`
  ).join("\n      ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:'Inter',-apple-system,system-ui,sans-serif;position:relative;background:${surfaceColor};">
  <!-- Food image upper portion -->
  ${imgSection}

  <!-- Recipe name header -->
  <div style="background:${primaryColor};padding:14px 40px;">
    <div style="font-size:30px;font-weight:800;color:${surfaceColor};letter-spacing:0.02em;">${headerText}</div>
  </div>

  <!-- Recipe content -->
  <div style="padding:16px 40px 60px 40px;background:${surfaceColor};overflow:hidden;">
    ${badgesHtml}
    ${ingredientsHtml}
    ${stepsHtml}
    ${proTipHtml}
  </div>

  <!-- Slide dots -->
  <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:2;">
      ${dots}
  </div>
</body>
</html>`;
}
