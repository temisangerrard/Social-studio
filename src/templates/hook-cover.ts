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
  const textSecondary = brandVisual.textSecondary ?? "#5C5450";

  const lines = (slide.text ?? "").split("\n");
  const title = escapeHtml(lines[0] ?? "").replace(/🍳|🍞/g, "").trim();
  const subtitle = escapeHtml(lines.slice(1).join(" ") ?? "");

  const dots = Array.from({ length: slideCount }, (_, i) =>
    `<div style="width:8px;height:8px;border-radius:50%;background:${i === slide.slide_number - 1 ? primaryColor : 'rgba(137,53,22,0.25)'};"></div>`
  ).join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;width:1080px;height:1080px;overflow:hidden;font-family:${font};position:relative;background:${accentColor};">
  <!-- Card -->
  <div style="position:absolute;top:60px;left:60px;right:60px;bottom:60px;background:${surfaceColor};border-radius:40px;box-shadow:0 8px 40px rgba(0,0,0,0.06);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;box-sizing:border-box;">
    <!-- Peppera wordmark -->
    <div style="font-size:18px;font-weight:700;color:${primaryColor};letter-spacing:0.15em;text-transform:uppercase;margin-bottom:48px;">Peppera</div>

    <!-- Title -->
    <h1 style="margin:0;font-size:72px;font-weight:800;color:${textColor};text-align:center;line-height:1.05;letter-spacing:-0.03em;">${title}</h1>

    <!-- Divider -->
    <div style="width:48px;height:4px;background:${primaryColor};border-radius:2px;margin:36px 0;"></div>

    <!-- Subtitle -->
    ${subtitle ? `<p style="margin:0;font-size:30px;font-weight:500;color:${textSecondary};text-align:center;line-height:1.4;">${subtitle}</p>` : ""}

    <!-- Swipe hint -->
    <div style="margin-top:56px;font-size:16px;color:${textSecondary};font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Swipe for recipes</div>
  </div>

  <!-- Dots -->
  <div style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:8px;">
          ${dots}
  </div>
</body>
</html>`;
}
