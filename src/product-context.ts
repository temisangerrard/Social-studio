import fs from "node:fs/promises";
import path from "node:path";
import type { ProductContextDefinition, ResolvedProductContext } from "./types.ts";

export const defaultProductRegistry: ProductContextDefinition[] = [
  {
    id: "peppera",
    name: "Peppera",
    sources: [
      { repo: "temisangerrard/systemeats", localPath: "/Users/temisan/Projects/systemeats" },
      { repo: "temisangerrard/systemeats" }
    ]
  },
  {
    id: "temisangerrard",
    name: "Temisangerrard",
    sources: [
      { repo: "temisangerrard/aos-studio", localPath: "/Users/temisan/Projects/aos-studio" },
      { repo: "temisangerrard/aos-studio" }
    ]
  },
  {
    id: "autobett",
    name: "AutoBett",
    sources: [
      { repo: "temisangerrard/autonomous-arena-scaffold", localPath: "/Users/temisan/Projects/autonomous-arena-scaffold" },
      { repo: "temisangerrard/autonomous-arena-scaffold" }
    ]
  },
  {
    id: "echocart",
    name: "EchoCart",
    sources: [
      { repo: "temisangerrard/echocart", localPath: "/Users/temisan/Projects/echocart" },
      { repo: "temisangerrard/echocart" }
    ]
  },
  {
    id: "settley",
    name: "Settley",
    sources: [
      { repo: "temisangerrard/settley-marketing", localPath: "/Users/temisan/Projects/settley-marketing" },
      { repo: "temisangerrard/settley-marketing" }
    ]
  }
];

export function findProductByRepo(repo: string): ProductContextDefinition | null {
  return (
    defaultProductRegistry.find((product) =>
      product.sources.some((source) => source.repo.toLowerCase() === repo.toLowerCase())
    ) ?? null
  );
}

export function findProductByText(text: string): ProductContextDefinition | null {
  const normalized = text.toLowerCase();
  return (
    defaultProductRegistry.find((product) =>
      normalized.includes(product.id.toLowerCase()) || normalized.includes(product.name.toLowerCase())
    ) ?? null
  );
}

async function readFirstExistingFile(paths: string[]): Promise<string | null> {
  for (const filePath of paths) {
    try {
      return await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }
  }

  return null;
}

function summarizeText(text: string, maxLength = 320): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

export async function resolveProductContext(productId: string): Promise<ResolvedProductContext> {
  const product = defaultProductRegistry.find((entry) => entry.id === productId) ?? defaultProductRegistry[0];
  const primarySource = product.sources[0];
  const localPath = primarySource.localPath;

  if (localPath) {
    const readme = await readFirstExistingFile([
      path.join(localPath, "README.md"),
      path.join(localPath, "readme.md")
    ]);
    const packageJson = await readFirstExistingFile([path.join(localPath, "package.json")]);
    const summaryParts: string[] = [];

    if (packageJson) {
      try {
        const parsed = JSON.parse(packageJson) as { description?: string };
        if (parsed.description) {
          summaryParts.push(parsed.description);
        }
      } catch {
        // ignore malformed package.json
      }
    }

    if (readme) {
      summaryParts.push(summarizeText(readme.replace(/^#.*$/m, "")));
    }

    if (summaryParts.length > 0) {
      return {
        productId: product.id,
        productName: product.name,
        summary: summarizeText(summaryParts.join(" ")),
        source: "local",
        repo: primarySource.repo
      };
    }
  }

  return {
    productId: product.id,
    productName: product.name,
    summary: `${product.name} product context from ${primarySource.repo}. Latest remote context is not available in-app yet, so this session will use registry-level context and your answers.`,
    source: "registry",
    repo: primarySource.repo
  };
}
