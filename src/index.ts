#!/usr/bin/env node
import path from "node:path";
import { runPipeline } from "./pipeline.ts";

interface CliArgs {
  briefPath?: string;
  outputRoot?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--brief" && next) {
      args.briefPath = next;
      index += 1;
      continue;
    }

    if (arg === "--output" && next) {
      args.outputRoot = next;
      index += 1;
    }
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.briefPath) {
    console.error("Usage: npm run generate -- --brief ./examples/brief-peppera.json [--output ./outputs]");
    process.exitCode = 1;
    return;
  }

  const metadata = await runPipeline({
    briefPath: path.resolve(args.briefPath),
    outputRoot: args.outputRoot ? path.resolve(args.outputRoot) : undefined
  });

  console.log(`Generated post ${metadata.post_id}`);
  console.log(`Caption: ${path.join(metadata.output_dir, "caption.txt")}`);
  console.log(`Metadata: ${path.join(metadata.output_dir, "metadata.json")}`);
  console.log(`Slides: ${metadata.slides_dir}`);
  console.log(`Assets: ${metadata.assets_dir}`);
}

main().catch((error) => {
  console.error("Pipeline failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
