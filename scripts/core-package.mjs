import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

export function resolveCorePackages(root) {
  const wrapperPath = path.join(
    root,
    "packages/react-native-nitro-modules/package.json",
  );
  const require = createRequire(wrapperPath);
  const corePath = path.dirname(require.resolve("nitro-core/package.json"));
  const nitrogenPath = path.dirname(
    createRequire(path.join(root, "package.json")).resolve(
      "nitrogen/package.json",
    ),
  );
  return { corePath, nitrogenPath, wrapperPath };
}

export function readCoreVersion(root) {
  const paths = resolveCorePackages(root);
  const core = readJson(path.join(paths.corePath, "package.json"));
  const nitrogen = readJson(path.join(paths.nitrogenPath, "package.json"));
  const version = core.version;
  const jsVersion = readFileSync(
    path.join(paths.corePath, "js/src/version.ts"),
    "utf8",
  ).match(/^export const version = '([^']+)'$/m)?.[1];
  const nativeVersion = readFileSync(
    path.join(paths.corePath, "native/cpp/utils/NitroDefines.hpp"),
    "utf8",
  ).match(/#define NITRO_VERSION "([^"]+)"/)?.[1];
  if (
    core.name !== "nitro-core" ||
    nitrogen.name !== "nitrogen" ||
    [nitrogen.version, jsVersion, nativeVersion].some(
      (value) => value !== version,
    ) ||
    ![version, `^${version}`].includes(nitrogen.dependencies?.["nitro-core"])
  ) {
    throw new Error(
      "Installed nitro-core, Nitrogen, JS version and NITRO_VERSION must match. Install matching core packages.",
    );
  }
  return { ...paths, version };
}
