const CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateCode(): string {
  const values = new Uint8Array(6);
  crypto.getRandomValues(values);
  return Array.from(values)
    .map((v) => CHARACTERS[v % CHARACTERS.length])
    .join("");
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type LinkRecord = { url: string; createdAt: number };

class LinkStore {
  private store = new Map<string, LinkRecord>();

  create(url: string, customAlias?: string) {
    if (!isValidUrl(url)) {
      throw new Error("Invalid URL");
    }

    if (customAlias) {
      const normalized = customAlias.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(normalized) || normalized.length < 2 || normalized.length > 30) {
        throw new Error("Invalid custom alias");
      }
      if (this.store.has(normalized)) {
        throw new Error("Alias taken");
      }
      this.store.set(normalized, { url, createdAt: Date.now() });
      return normalized;
    }

    let code = generateCode();
    let attempts = 0;
    while (this.store.has(code) && attempts < 10) {
      code = generateCode();
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error("Failed to generate code");
    }

    this.store.set(code, { url, createdAt: Date.now() });
    return code;
  }

  get(code: string) {
    return this.store.get(code) || null;
  }
}

export const links = new LinkStore();
