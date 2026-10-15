import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readJson } from "./core-package.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
// The initial split predates its first npm release. Only that checkout needs Git.
if (
  readJson(path.join(root, "package.json")).workspaces.includes(
    "packages/react-native-nitro-modules/nitro/packages/nitro-core",
  )
) {
  execFileSync(
    "git",
    [
      "submodule",
      "update",
      "--init",
      "--recursive",
      "--",
      "packages/react-native-nitro-modules/nitro",
    ],
    { cwd: root, stdio: "inherit" },
  );
}
