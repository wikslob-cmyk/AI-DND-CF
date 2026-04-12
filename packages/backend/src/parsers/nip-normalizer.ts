const NIP_LENGTH = 10;

export function normalizeNip(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  let nip = raw.trim();

  // Remove PL prefix (case-insensitive)
  if (nip.toUpperCase().startsWith("PL")) {
    nip = nip.slice(2);
  }

  // Remove dashes, spaces, dots
  nip = nip.replace(/[\s\-./]/g, "");

  return nip;
}

export function isValidNip(nip: string): boolean {
  if (nip.length !== NIP_LENGTH) {
    return false;
  }
  return /^\d{10}$/.test(nip);
}
