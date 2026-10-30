import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "src");
const banned = [
  "eth_signTypedData",
  "eth_sendTransaction",
  "signAuthorization",
  "approve(",
  "permit(",
];

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(full)));
    else out.push(full);
  }
  return out;
}

const found = [];
for (const file of await files(root)) {
  let text = "";
  try {
    text = await readFile(file, "utf8");
  } catch {
    continue;
  }
  for (const word of banned) {
    if (text.includes(word)) found.push(`${path.relative(process.cwd(), file)} contains ${word}`);
  }
}

if (found.length > 0) {
  for (const line of found) console.error(line);
  process.exit(1);
}

console.log("Signing check ok.");
