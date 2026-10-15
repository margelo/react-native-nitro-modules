import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, resolveCorePackages } from "./core-package.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const { nitrogenPath } = resolveCorePackages(root);
const pkg = readJson(path.join(nitrogenPath, "package.json"));
const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.nitrogen;
execFileSync(
  process.execPath,
  [path.join(nitrogenPath, bin), ...process.argv.slice(2)],
  { stdio: "inherit" },
);
