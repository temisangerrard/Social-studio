import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";

// ═══════════════════════════════════════════════════════════════════════════════
// Property tests for card selection (Feature: interactive-canvas-editor)
//
// Property 4: Exclusive selection invariant
// Property 5: Detail panel reflects selected card data
//
// These tests validate pure logic without requiring a browser DOM.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Selection model (mirrors SelectionManager logic) ──────────────────────────

/**
 * Pure model of the SelectionManager's selection logic.
 * Tracks which ID is selected; at most one at a time.
 */
class SelectionModel {
  selectedId: string | null = null;
  private ids: string[];

  constructor(ids: string[]) {
    this.ids = ids;
  }

  select(id: string | null) {
    this.selectedId = id && this.ids.includes(id) ? id : null;
  }

  deselect() {
    this.selectedId = null;
  }
}

// ── Property 4: Exclusive selection invariant ─────────────────────────────────

test("Feature: interactive-canvas-editor, Property 4: Exclusive selection invariant — at most one card selected at any time", () => {
  fc.assert(
    fc.property(
      // Generate strip size (2–10 cards) and a sequence of click actions (1–20)
      fc.integer({ min: 2, max: 10 }),
      fc.array(
        fc.oneof(
          fc.record({ type: fc.constant("click" as const), index: fc.integer({ min: 0, max: 9 }) }),
          fc.record({ type: fc.constant("deselect" as const) })
        ),
        { minLength: 1, maxLength: 20 }
      ),
      (cardCount, actions) => {
        const ids = Array.from({ length: cardCount }, (_, i) =>
          `artboard-${String(i + 1).padStart(2, "0")}`
        );
        const model = new SelectionModel(ids);

        for (const action of actions) {
          if (action.type === "click") {
            const idx = action.index % cardCount;
            model.select(ids[idx]);
          } else {
            model.deselect();
          }

          // Invariant: at most one card is selected
          const selectedCount = ids.filter(id => id === model.selectedId).length;
          assert.ok(
            selectedCount <= 1,
            `Expected at most 1 selected card, found ${selectedCount}`
          );

          // If we just clicked a valid card, exactly that card is selected
          if (action.type === "click") {
            const idx = action.index % cardCount;
            assert.equal(
              model.selectedId,
              ids[idx],
              "Selected card should match the clicked card"
            );
          } else {
            assert.equal(
              model.selectedId,
              null,
              "No card should be selected after deselect"
            );
          }
        }
      }
    ),
    { numRuns: 100 }
  );
});

// ── Detail panel data extraction (mirrors populateDetailPanel logic) ──────────

/**
 * Pure function that extracts the detail panel data from an artboard descriptor
 * and a slides array — mirrors the logic in populateDetailPanel().
 */
function extractDetailPanelData(
  artboardDesc: { slideNumber: number; order: number; role: string; text: string; prompt: string },
  slides: Array<{ slide_number: number; role: string; text: string; image_prompt: string; recipe?: any }>
) {
  const slide = slides.find(s => s.slide_number === artboardDesc.slideNumber)
    || slides[artboardDesc.order];

  return {
    slideNumber: artboardDesc.slideNumber ?? slide?.slide_number ?? null,
    role: artboardDesc.role || slide?.role || "slide",
    text: slide?.text || artboardDesc.text || "",
    imagePrompt: slide?.image_prompt || artboardDesc.prompt || "",
    recipe: slide?.recipe || null,
  };
}

// ── Property 5: Detail panel reflects selected card data ──────────────────────

test("Feature: interactive-canvas-editor, Property 5: Detail panel reflects selected card data", () => {
  const roleArb = fc.constantFrom("hook", "recipe", "cta", "slide");
  const recipeArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    cook_time: fc.string({ minLength: 1, maxLength: 20 }),
    ingredients: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
    steps: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
    pro_tip: fc.string({ minLength: 0, maxLength: 50 }),
  });

  // Generate slides with UNIQUE slide_numbers to avoid ambiguity in find()
  const slidesArb = fc.integer({ min: 1, max: 10 }).chain(count => {
    // Generate `count` unique slide numbers
    return fc.uniqueArray(fc.integer({ min: 1, max: 20 }), { minLength: count, maxLength: count }).chain(slideNumbers => {
      return fc.tuple(
        ...slideNumbers.map(sn =>
          fc.record({
            slide_number: fc.constant(sn),
            role: roleArb,
            text: fc.string({ minLength: 0, maxLength: 200 }),
            image_prompt: fc.string({ minLength: 0, maxLength: 200 }),
            recipe: fc.option(recipeArb, { nil: null }),
          })
        )
      );
    });
  });

  fc.assert(
    fc.property(
      slidesArb,
      (slides) => {
        // Pick a random slide to select
        const idx = 0; // Always test the first slide for simplicity in the chain
        const slide = slides[idx];

        const artboardDesc = {
          slideNumber: slide.slide_number,
          order: idx,
          role: slide.role,
          text: slide.text,
          prompt: slide.image_prompt,
        };

        const panelData = extractDetailPanelData(artboardDesc, slides);

        // The panel should reflect the slide data
        assert.equal(panelData.slideNumber, slide.slide_number, "Slide number should match");
        assert.equal(panelData.role, slide.role, "Role should match");
        assert.equal(panelData.text, slide.text, "Text should match");
        assert.equal(panelData.imagePrompt, slide.image_prompt, "Image prompt should match");
        assert.deepEqual(panelData.recipe, slide.recipe, "Recipe should match");
      }
    ),
    { numRuns: 100 }
  );
});
