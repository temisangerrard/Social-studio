import type { Slide } from "../types.ts";

export interface SlideTemplateInput {
  slide: Slide;
  productName: string;
  imageDataUrl?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderBaseTemplate(input: SlideTemplateInput): string {
  const { slide, productName, imageDataUrl } = input;
  const text = escapeHtml(slide.text ?? "");
  const handle = `@${productName.toLowerCase()}`;

  const isHook = slide.role === "hook";
  const isCta = slide.role === "cta";

  const textPosition = isHook
    ? `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 85%; text-align: center;`
    : `position: absolute; bottom: 140px; left: 60px; right: 60px;`;

  const fontSize = isHook ? `130px` : isCta ? `120px` : `110px`;
  const textColor = isCta ? `#f04d23` : `#ffffff`;

  const watermark = isHook ? `` : `<div class="watermark">${escapeHtml(handle)}</div>`;

  const imgTag = imageDataUrl
    ? `<img class="bg-photo" src="${imageDataUrl}" alt="" />`
    : `<div class="bg-fallback"></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      width: 1080px;
      height: 1920px;
      overflow: hidden;
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      position: relative;
      background: #0f0b09;
    }

    .bg-photo {
      position: absolute;
      top: 0; left: 0;
      width: 1080px;
      height: 1920px;
      object-fit: cover;
      z-index: 0;
    }

    .bg-fallback {
      position: absolute;
      top: 0; left: 0;
      width: 1080px;
      height: 1920px;
      background: linear-gradient(135deg, #1a1412 0%, #2a1b15 100%);
      z-index: 0;
    }

    .overlay {
      position: absolute;
      top: 0; left: 0;
      width: 1080px;
      height: 1920px;
      background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 45%, transparent 100%);
      z-index: 1;
    }

    .text-overlay {
      ${textPosition}
      z-index: 2;
    }

    .text-overlay h1 {
      font-size: ${fontSize};
      font-weight: 900;
      color: ${textColor};
      text-shadow: 0 4px 30px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5);
      line-height: 0.95;
      letter-spacing: -0.04em;
      margin: 0;
    }

    .watermark {
      position: absolute;
      top: 48px;
      left: 56px;
      z-index: 2;
      font-size: 26px;
      font-weight: 700;
      color: rgba(255,255,255,0.7);
      text-shadow: 0 2px 12px rgba(0,0,0,0.5);
      letter-spacing: 0.02em;
    }

    .slide-indicator {
      position: absolute;
      bottom: 56px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
      display: flex;
      gap: 12px;
    }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
    }
    .dot.active {
      background: #f04d23;
    }
  </style>
</head>
<body>
  ${imgTag}
  <div class="overlay"></div>
  ${watermark}
  <div class="text-overlay">
    <h1>${text}</h1>
  </div>
  <div class="slide-indicator">
    ${Array.from({length: 8}, (_, i) => `<div class="dot${i + 1 === slide.slide_number ? ' active' : ''}"></div>`).join('\n    ')}
  </div>
</body>
</html>`;
}
