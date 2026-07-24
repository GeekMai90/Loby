/**
 * [INPUT]: 依赖 Web Crypto 安全随机数能力
 * [OUTPUT]: 对外提供 createSheetId、isCanonicalSheetId、sheetPublicId
 * [POS]: library model 的文稿身份规则，统一新建、导入、AI 创建与博客公开地址
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

const SHEET_ID_PREFIX = "sheet-";
const BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const BASE32_LENGTH = 26;

export function createSheetId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${SHEET_ID_PREFIX}${encodeBase32(bytes)}`;
}

export function isCanonicalSheetId(value: string): boolean {
  const publicId = value.startsWith(SHEET_ID_PREFIX) ? value.slice(SHEET_ID_PREFIX.length) : "";
  return publicId.length === BASE32_LENGTH && [...publicId].every((character) => BASE32_ALPHABET.includes(character));
}

export function sheetPublicId(value: string): string | null {
  return isCanonicalSheetId(value) ? value.slice(SHEET_ID_PREFIX.length) : null;
}

function encodeBase32(bytes: Uint8Array): string {
  let buffer = 0;
  let bits = 0;
  let output = "";

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(buffer >>> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return output;
}
