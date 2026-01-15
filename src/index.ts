import { runCli } from "./cli";

// When running via `bun run src/index.ts`, behave like the CLI.
runCli(process.argv.slice(2)).catch((error) => {
  console.error("Error:", error?.message ?? String(error));
  process.exit(1);
});