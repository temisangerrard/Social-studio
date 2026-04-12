import assert from "node:assert/strict";
import test from "node:test";
import { createInitialAssistantSession, getNextInterviewQuestion } from "./assistant.ts";

test("assistant session starts in interviewing state", () => {
  const session = createInitialAssistantSession("peppera");
  assert.equal(session.status, "interviewing");
  assert.equal(session.productId, "peppera");
  assert.equal(session.messages[0].role, "system");
  assert.equal(session.messages[1].role, "assistant");
});

test("assistant asks for missing fields one at a time", () => {
  const question = getNextInterviewQuestion({
    goal: "",
    audience: "busy home cooks",
    offer: "",
    tone: "",
    platform: "tiktok"
  });

  assert.match(question, /what do you want this content to do/i);
});
