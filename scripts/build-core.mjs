import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, resolveCorePackages } from "./core-package.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const bootstrapWorkspace =
  "packages/react-native-nitro-modules/nitro/packages/nitro-core";
if (
  readJson(path.join(root, "package.json")).workspaces.includes(
    bootstrapWorkspace,
  )
) {
  const { corePath, nitrogenPath } = resolveCorePackages(root);
  for (const cwd of [corePath, nitrogenPath]) {
    execFileSync("bun", ["run", "build"], { cwd, stdio: "inherit" });
  }
}
