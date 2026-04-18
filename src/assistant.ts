import { findProductByText } from "./product-context.ts";
import type { AssistantSession, BrandProfile, InferredBrief, ResolvedProductContext } from "./types.ts";

function now(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanJsonString(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function getNextInterviewQuestion(brief: InferredBrief): string {
  if (!brief.goal.trim()) {
    return "What do you want this content to do for you?";
  }

  if (!brief.audience.trim()) {
    return "Who is this for?";
  }

  if (!brief.offer.trim()) {
    return "What is the main thing you want to say or sell?";
  }

  if (!brief.platform.trim()) {
    return "Where should I optimise it first? TikTok, Instagram, or somewhere else?";
  }

  if (!brief.tone.trim()) {
    return "What should it feel like? For example: calm, sharp, funny, premium, simple.";
  }

  return "I have enough to start making this. If there is one thing I must not miss, what is it?";
}

function hasAlreadyGenerated(session: AssistantSession): boolean {
  return session.status === "done" || session.status === "generating" ||
    session.checkpoints.finalPackage === "done";
}

function fallbackAssistantReply(
  session: AssistantSession,
  userMessage: string
): { reply: string; updatedBrief: InferredBrief; shouldGenerate: boolean } {
  const brief = { ...session.inferredBrief };

  // If we already generated, treat follow-up messages as new directions
  if (hasAlreadyGenerated(session)) {
    return {
      reply: "Got it — I'll generate a new package with that direction.",
      updatedBrief: { ...brief, goal: userMessage },
      shouldGenerate: true
    };
  }

  if (!brief.goal) brief.goal = userMessage;
  else if (!brief.audience) brief.audience = userMessage;
  else if (!brief.offer) brief.offer = userMessage;
  else if (!brief.platform) brief.platform = userMessage;
  else if (!brief.tone) brief.tone = userMessage;

  const shouldGenerate =
    Boolean(brief.goal) &&
    Boolean(brief.audience) &&
    Boolean(brief.offer) &&
    Boolean(brief.platform) &&
    Boolean(brief.tone);

  const reply = shouldGenerate
    ? "I have everything I need. Moving into content generation now."
    : getNextInterviewQuestion(brief);

  return { reply, updatedBrief: brief, shouldGenerate };
}

export interface AssistantReplyResult {
  reply: string;
  updatedBrief: InferredBrief;
  shouldGenerate: boolean;
}

export async function generateAssistantReply(
  session: AssistantSession,
  userMessage: string,
  brand: BrandProfile | null
): Promise<AssistantReplyResult> {
  const apiKey = process.env.GLM_API_KEY;
  const apiUrl = process.env.GLM_API_URL ?? "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const model = process.env.GLM_MODEL ?? brand?.providers.plannerModel ?? "glm-4.5";

  if (!apiKey) {
    return fallbackAssistantReply(session, userMessage);
  }

  const brief = session.inferredBrief;
  const brandName = brand?.name ?? session.productId;
  const brandDescription = brand?.description ?? "";
  const brandAudience = brand?.audience ?? "";
  const brandTone = brand?.tone ?? "";

  const systemPrompt = [
    `You are a social media content assistant for ${brandName}. ${brandDescription}`,
    `Default audience: ${brandAudience}. Default tone: ${brandTone}.`,
    "",
    "Your job: gather a content brief by asking ONE question at a time. Be direct and conversational.",
    "You can suggest content ideas if the user seems stuck or asks for inspiration.",
    "",
    "Current brief state:",
    `- Goal: ${brief.goal || "(not set)"}`,
    `- Audience: ${brief.audience || "(not set)"}`,
    `- Key message or offer: ${brief.offer || "(not set)"}`,
    `- Platform: ${brief.platform || "(not set)"}`,
    `- Tone: ${brief.tone || "(not set)"}`,
    "",
    "Rules:",
    "1. Extract any relevant info the user provides and update the matching brief field.",
    "2. If a field can be inferred from context (e.g. audience = 'home cooks' for a recipe app), fill it.",
    "3. Ask ONE clear question about the most important missing field.",
    "4. Once all fields are filled AND user confirms or gives final detail, set shouldGenerate=true.",
    "5. Keep replies short. No unnecessary preamble.",
    "",
    "Return JSON only:",
    '{ "reply": "...", "brief": { "goal": "...", "audience": "...", "offer": "...", "platform": "...", "tone": "..." }, "shouldGenerate": false }'
  ].join("\n");

  const conversationMessages = session.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.text
    }));

  conversationMessages.push({ role: "user", content: userMessage });

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationMessages
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`GLM request failed (${response.status})`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("GLM response had no content");

    const parsed = JSON.parse(cleanJsonString(content)) as {
      reply?: string;
      brief?: Partial<InferredBrief>;
      shouldGenerate?: boolean;
    };

    const updatedBrief: InferredBrief = {
      goal: String(parsed.brief?.goal ?? brief.goal ?? ""),
      audience: String(parsed.brief?.audience ?? brief.audience ?? ""),
      offer: String(parsed.brief?.offer ?? brief.offer ?? ""),
      platform: String(parsed.brief?.platform ?? brief.platform ?? ""),
      tone: String(parsed.brief?.tone ?? brief.tone ?? "")
    };

    return {
      reply: String(parsed.reply ?? getNextInterviewQuestion(updatedBrief)),
      updatedBrief,
      shouldGenerate: Boolean(parsed.shouldGenerate)
    };
  } catch (error) {
    console.warn(`[assistant] GLM reply failed, using fallback: ${(error as Error).message}`);
    return fallbackAssistantReply(session, userMessage);
  }
}

export function inferProductIdFromText(text: string, fallbackProductId: string): string {
  return findProductByText(text)?.id ?? fallbackProductId;
}

export function createInitialAssistantSession(
  productId: string,
  context?: ResolvedProductContext
): AssistantSession {
  const createdAt = now();
  const inferredBrief: InferredBrief = {
    goal: "",
    audience: "",
    offer: "",
    tone: "",
    platform: ""
  };
  const currentQuestion = "What do you want to make today?";
  const systemText = context
    ? `Hidden product context for ${context.productName}: ${context.summary}`
    : `Hidden product context for ${productId}.`;

  return {
    id: makeId("session"),
    productId,
    status: "interviewing",
    currentQuestion,
    messages: [
      {
        id: makeId("msg"),
        role: "system",
        text: systemText,
        createdAt
      },
      {
        id: makeId("msg"),
        role: "assistant",
        text: "Tell me the rough idea first. I’ll help shape it and ask only one thing at a time.",
        createdAt
      },
      {
        id: makeId("msg"),
        role: "assistant",
        text: currentQuestion,
        createdAt
      }
    ],
    inferredBrief,
    checkpoints: {
      strategy: "pending",
      hooks: "pending",
      visuals: "pending",
      finalPackage: "pending"
    },
    workspaceCards: [],
    createdAt,
    updatedAt: createdAt
  };
}
