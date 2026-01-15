// build.ts
import { $ } from "bun";

async function build() {
  const targets = [
    { platform: "linux", arch: "x64", output: "viral-linux-x64" },
    { platform: "linux", arch: "arm64", output: "viral-linux-arm64" },
    { platform: "darwin", arch: "x64", output: "viral-macos-x64" },
    { platform: "darwin", arch: "arm64", output: "viral-macos-arm64" },
    { platform: "windows", arch: "x64", output: "viral-windows-x64.exe" },
  ];

  for (const target of targets) {
    console.log(`Building for ${target.platform}-${target.arch}...`);

    await $`bun build ./cli.ts \
      --compile \
      --target=bun-${target.platform}-${target.arch} \
      --outfile=./release/${target.output}`;
  }

  console.log("Build completed!");
}

build().catch(console.error);