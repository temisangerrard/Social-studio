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
  const font = brandVisual.fontFamily ?? "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  const textColor = brandVisual.textColor ?? "#1D1B19";
  const textSecondary = brandVisual.textSecondary ?? "#5C5450";
  const recipe = slide.recipe;

  const recipeName = escapeHtml(recipe?.recipeName ?? "Recipe");
  const ingredients = recipe?.ingredients ?? [];
  const steps = recipe?.steps ?? [];
  const cookTime = escapeHtml(recipe?.cookTime ?? "");
  const serves = escapeHtml(recipe?.serves ?? "");
  const cost = escapeHtml(recipe?.cost ?? "");
  const proTip = recipe?.proTip ? escapeHtml(recipe.proTip) : "";

  const imgSection = imageDataUrl
    ? `<img src="${imageDataUrl}" alt="" style="width:100%;height:400px;object-fit:cover;display:block;border-radius:32px 32px 0 0;" />`
    : `<div style="width:100%;height:400px;background:${secondaryColor};display:flex;align-items:center;justify-content:center;border-radius:32px 32px 0 0;">
        <span style="font-size:100px;">🍽️</span>
      </div>`;

  // Badges
  const badges: string[] = [];
  if (cookTime) badges.push(`⏱️ ${cookTime}`);
  if (serves) badges.push(`👤 ${serves}`);
  if (cost) badges.push(`💰 ${cost}`);
  const badgesHtml = badges.length > 0
    ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        ${badges.map((b) => `<span style="background:${secondaryColor};color:${primaryColor};font-size:20px;font-weight:700;padding:6px 14px;border-radius:16px;">${b}</span>`).join("\n        ")}
      </div>`
    : "";

  // Ingredients
  const ingredientsHtml = ingredients.length > 0
    ? `<div style="margin-bottom:12px;">
        <div style="font-size:18px;font-weight:800;color:${primaryColor};margin-bottom:6px;letter-spacing:0.08em;text-transform:uppercase;">Ingredients</div>
        <div style="display:flex;flex-wrap:wrap;gap:2px 20px;">
          ${ingredients.map((ing) => `<div style="font-size:19px;color:${textColor};line-height:1.5;width:calc(50% - 10px);">• ${escapeHtml(ing)}</div>`).join("\n          ")}
        </div>
      </div>`
    : "";

  // Steps
  const stepsHtml = steps.length > 0
    ? `<div style="margin-bottom:10px;">
        <div style="font-size:18px;font-weight:800;color:${primaryColor};margin-bottom:6px;letter-spacing:0.08em;text-transform:uppercase;">Method</div>
        ${steps.map((step, i) => `<div style="font-size:19px;color:${textColor};line-height:1.5;margin-bottom:3px;"><span style="font-weight:800;color:${primaryColor};">${i + 1}.</span> ${escapeHtml(step)}</div>`).join("\n        ")}
      </div>`
    : "";

  const proTipHtml = proTip
    ? `<div style="background:${secondaryColor};border-radius:12px;padding:10px 16px;margin-top:6px;font-size:18px;color:${primaryColor};font-weight:600;">💡 ${proTip}</div>`
    : "";

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:10px;height:10px;border-radius:50%;background:${i === slide.slide_number - 1 ? primaryColor : secondaryColor};"></div>`
  ).join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:${font};position:relative;background:${accentColor};">
  <!-- Card -->
  <div style="position:absolute;top:40px;left:40px;right:40px;bottom:40px;background:${surfaceColor};border-radius:32px;box-shadow:0 8px 40px rgba(0,0,0,0.08);overflow:hidden;display:flex;flex-direction:column;">
    <!-- Food image -->
    ${imgSection}

    <!-- Recipe name -->
    <div style="padding:14px 36px;background:${primaryColor};">
      <div style="font-size:26px;font-weight:800;color:${surfaceColor};letter-spacing:-0.01em;">${escapeHtml(slide.text ?? recipeName)}</div>
    </div>

    <!-- Content -->
    <div style="padding:14px 36px 20px 36px;flex:1;overflow:hidden;">
      ${badgesHtml}
      ${ingredientsHtml}
      ${stepsHtml}
      ${proTipHtml}
    </div>
  </div>

  <!-- Dots -->
  <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:10px;">
          ${dots}
  </div>
</body>
</html>`;
}
