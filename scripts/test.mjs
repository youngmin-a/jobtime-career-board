import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".test-output",{recursive:true});
await build({entryPoints:["tests/domain.test.ts"],bundle:true,platform:"node",format:"esm",outfile:".test-output/domain.test.mjs"});
const result=spawnSync(process.execPath,["--test",".test-output/domain.test.mjs"],{stdio:"inherit"});process.exitCode=result.status??1;
