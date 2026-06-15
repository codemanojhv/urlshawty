import fs from "node:fs/promises";
import path from "node:path";

const isServerless = process.env.VERCEL === "1";
const DATA_DIR = isServerless
  ? "/tmp/urlshawtys"
  : path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "links.json");

async function ensure() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, "[]", "utf-8");
  }
}

export type LinkRecord = {
  code: string;
  url: string;
  createdAt: string;
  clicks: number;
  clickHistory: {
    ip: string;
    userAgent: string;
    referrer: string;
    country: string;
    device: string;
    timestamp: string;
  }[];
  ownerEmail?: string | null;
};

async function readAll(): Promise<LinkRecord[]> {
  await ensure();
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    return (JSON.parse(raw) as LinkRecord[]).filter(Boolean);
  } catch {
    return [];
  }
}

async function writeAll(items: LinkRecord[]) {
  await writeFileAtomic(FILE, JSON.stringify(items, null, 2));
}

async function writeFileAtomic(file: string, contents: string) {
  await ensure();
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, contents, "utf-8");
  await fs.rename(tmp, file);
}

export async function createLinkRecord(link: LinkRecord): Promise<LinkRecord> {
  const items = await readAll();
  const existing = items.find((item) => item.code === link.code || item.url === link.url);
  if (existing) return existing;
  items.unshift(link);
  await writeAll(items);
  return link;
}

export async function findLinkByCode(code: string): Promise<LinkRecord | undefined> {
  const items = await readAll();
  return items.find((item) => item.code === code);
}

export async function recordClickFor(code: string, clickData: {
  ip: string;
  userAgent: string;
  referrer: string;
  country: string;
  device: string;
}): Promise<LinkRecord | undefined> {
  const items = await readAll();
  const item = items.find((entry) => entry.code === code);
  if (!item) return undefined;

  item.clicks += 1;
  item.clickHistory = [
    ...item.clickHistory,
    {
      ip: clickData.ip,
      userAgent: clickData.userAgent,
      referrer: clickData.referrer,
      country: clickData.country,
      device: clickData.device,
      timestamp: new Date().toISOString(),
    },
  ];

  if (item.clickHistory.length > 1000) {
    item.clickHistory = item.clickHistory.slice(-1000);
  }

  await writeAll(items);
  return item;
}

export async function listRecent(limit = 50): Promise<LinkRecord[]> {
  const items = await readAll();
  return items
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

export async function getAnalyticsFor(code: string) {
  const link = await findLinkByCode(code);
  if (!link) return null;

  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const clicks = link.clickHistory ?? [];

  const clicks24h = clicks.filter(
    (c) => now.getTime() - new Date(c.timestamp).getTime() < oneDay
  ).length;
  const clicks7d = clicks.filter(
    (c) => now.getTime() - new Date(c.timestamp).getTime() < oneWeek
  ).length;

  const referrerCounts: Record<string, number> = {};
  clicks.forEach((c) => {
    const ref = c.referrer || "direct";
    referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
  });
  const topReferrers = Object.entries(referrerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([referrer, count]) => ({ referrer, count }));

  const countryCounts: Record<string, number> = {};
  clicks.forEach((c) => {
    const country = c.country || "unknown";
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  });
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }));

  const deviceCounts: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0, other: 0 };
  clicks.forEach((c) => {
    const raw = c.device || "other";
    deviceCounts[raw] = (deviceCounts[raw] || 0) + 1;
  });

  return {
    code,
    originalUrl: link.url,
    createdAt: link.createdAt,
    totalClicks: link.clicks,
    clicks24h,
    clicks7d,
    topReferrers,
    topCountries,
    deviceBreakdown: deviceCounts,
    recentClicks: clicks.slice(-10).reverse(),
  };
}

export async function listLinksForOwner(ownerEmail: string): Promise<LinkRecord[]> {
  const items = await readAll();
  const normalized = ownerEmail.toLowerCase();
  return items
    .filter((item) => item.ownerEmail === normalized)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}
