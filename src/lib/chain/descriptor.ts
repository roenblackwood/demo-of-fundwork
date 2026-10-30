import "server-only";

import { createHash } from "node:crypto";

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

export type DescriptorCheck =
  | { ok: true; address: string; threshold: number; owners: number }
  | { ok: false; reason: string };

function polymod(values: number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let index = 0; index < 5; index += 1) {
      const generator = GENERATORS[index] ?? 0;
      if ((top >>> index) & 1) chk ^= generator;
    }
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (const char of hrp) out.push(char.charCodeAt(0) >> 5);
  out.push(0);
  for (const char of hrp) out.push(char.charCodeAt(0) & 31);
  return out;
}

function checksum(hrp: string, data: number[]): number[] {
  const values = hrpExpand(hrp).concat(data, [0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const out: number[] = [];
  for (let index = 0; index < 6; index += 1) out.push((mod >>> (5 * (5 - index))) & 31);
  return out;
}

function encodeBech32(hrp: string, data: number[]): string {
  let out = `${hrp}1`;
  for (const value of data.concat(checksum(hrp, data))) out += CHARSET[value] ?? "";
  return out;
}

function convertBits(data: Uint8Array): number[] | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const value of data) {
    acc = (acc << 8) | value;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out.push((acc >>> bits) & 31);
    }
  }
  if (bits) out.push((acc << (5 - bits)) & 31);
  return out;
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const gap = (left[index] ?? 0) - (right[index] ?? 0);
    if (gap !== 0) return gap;
  }
  return left.length - right.length;
}

function scriptFor(threshold: number, keys: Uint8Array[], sorted: boolean): Uint8Array {
  const ordered = sorted ? [...keys].sort(compareBytes) : keys;
  const parts: number[] = [0x50 + threshold];
  for (const key of ordered) {
    parts.push(key.length);
    for (const byte of key) parts.push(byte);
  }
  parts.push(0x50 + ordered.length, 0xae);
  return Uint8Array.from(parts);
}

function p2wsh(script: Uint8Array): string | null {
  const hash = createHash("sha256").update(script).digest();
  const five = convertBits(hash);
  if (!five) return null;
  return encodeBech32("tb", [0, ...five]);
}

function keyBytes(token: string): Uint8Array | null {
  const body = token.replace(/^\[[^\]]+\]/, "");
  if (!/^(02|03)[0-9a-fA-F]{64}$/.test(body)) return null;
  const bytes = new Uint8Array(body.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(body.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

/** 2-of-3 or stricter: at least 3 keys, and at least as strict as 2 of 3. */
export function strictEnough(threshold: number, owners: number): boolean {
  return threshold >= 2 && owners >= 3 && threshold * 3 >= owners * 2;
}

/**
 * Signet witness address for wsh(multi(...)) or wsh(sortedmulti(...)).
 * Keys are compressed public keys. An xpub is refused.
 */
export function bitcoinMultisigAddress(descriptor: string): DescriptorCheck {
  const trimmed = descriptor.trim().replace(/\s+/g, "").replace(/#[a-z0-9]{8}$/i, "");
  const match = /^wsh\((sortedmulti|multi)\((\d+),(.+)\)\)$/.exec(trimmed);
  if (!match) {
    return { ok: false, reason: "Use a wsh multisig descriptor on signet." };
  }
  const sorted = match[1] === "sortedmulti";
  const threshold = Number(match[2]);
  const tokens = (match[3] ?? "").split(",").filter(Boolean);
  if (!Number.isInteger(threshold) || tokens.length < threshold) {
    return { ok: false, reason: "That descriptor does not list enough keys." };
  }
  if (!strictEnough(threshold, tokens.length)) {
    return { ok: false, reason: "Use a 2-of-3 wallet, or one that asks for more keys." };
  }
  const keys: Uint8Array[] = [];
  for (const token of tokens) {
    const key = keyBytes(token);
    if (!key) return { ok: false, reason: "Use compressed public keys in the descriptor." };
    keys.push(key);
  }
  const address = p2wsh(scriptFor(threshold, keys, sorted));
  if (!address) return { ok: false, reason: "That descriptor did not make an address." };
  return { ok: true, address, threshold, owners: keys.length };
}
