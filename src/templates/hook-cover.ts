import type { CarouselTemplateInput } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderHookCoverTemplate(input: CarouselTemplateInput): string {
  const { slide, brandVisual, slideCount } = input;
  const { primaryColor, secondaryColor, accentColor, surfaceColor } = brandVisual;
  const font = brandVisual.fontFamily ?? "'Avenir Next', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  const textColor = brandVisual.textColor ?? "#1D1B19";

  const lines = (slide.text ?? "").split("\n");
  const title = escapeHtml(lines[0] ?? "");
  const subtitle = escapeHtml(lines.slice(1).join(" ") ?? "");

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:10px;height:10px;border-radius:50%;background:${i === slide.slide_number - 1 ? primaryColor : secondaryColor};"></div>`
  ).join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:${font};position:relative;background:${accentColor};">
  <!-- Card -->
  <div style="position:absolute;top:60px;left:60px;right:60px;bottom:60px;background:${surfaceColor};border-radius:40px;box-shadow:0 8px 40px rgba(0,0,0,0.08);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;box-sizing:border-box;">
    <!-- Emoji -->
    <div style="font-size:72px;margin-bottom:36px;">🍳🍞</div>

    <!-- Title -->
    <h1 style="margin:0;font-size:72px;font-weight:800;color:${textColor};text-align:center;line-height:1.05;letter-spacing:-0.03em;">${title}</h1>

    <!-- Divider -->
    <div style="width:80px;height:5px;background:${primaryColor};border-radius:3px;margin:32px 0;"></div>

    <!-- Subtitle -->
    ${subtitle ? `<p style="margin:0;font-size:32px;font-weight:500;color:${brandVisual.textSecondary ?? '#5C5450'};text-align:center;line-height:1.4;">${subtitle}</p>` : ""}

    <!-- Swipe hint -->
    <div style="margin-top:48px;font-size:24px;color:${brandVisual.textSecondary ?? '#5C5450'};font-weight:600;letter-spacing:0.04em;">SWIPE → FOR RECIPES</div>
  </div>

  <!-- Dots -->
  <div style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:10px;">
          ${dots}
  </div>
</body>
</html>`;
}
