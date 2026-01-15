#!/usr/bin/env bun

import { runCli } from "./src/cli";

runCli(process.argv.slice(2)).catch((error) => {
  console.error("Error:", error?.message ?? String(error));
  process.exit(1);
});