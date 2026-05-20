import { readFileSync } from "node:fs";

export { readFileSync };

const moduleRoot = "spacetimedb/src";

export function moduleSource(): string {
  const seen = new Set<string>();

  const expand = (path: string): string => {
    if (seen.has(path)) {
      return "";
    }

    seen.add(path);
    const source = readFileSync(path, "utf8");

    return source.replace(/include!\("([^"]+)"\);/g, (_match, file: string) => {
      return `\n${expand(`${moduleRoot}/${file}`)}\n`;
    });
  };

  return expand(`${moduleRoot}/lib.rs`);
}
