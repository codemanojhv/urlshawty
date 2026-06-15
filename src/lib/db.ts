import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDataDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

type LinkRow = {
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
};

async function readLinks(): Promise<LinkRow[]> {
  await ensureDataDir();
  const dbPath = path.join(DATA_DIR, "links.json");
  try {
    const content = await fs.readFile(dbPath, "utf-8");
    return JSON.parse(content) as LinkRow[];
  } catch {
    return [];
  }
}

async function writeLinks(links: LinkRow[]): Promise<void> {
  await ensureDataDir();
  const dbPath = path.join(DATA_DIR, "links.json");
  await fs.writeFile(dbPath, JSON.stringify(links, null, 2), "utf-8");
}

export async function findByCode(code: string): Promise<LinkRow | undefined> {
  const links = await readLinks();
  return links.find((link) => link.code === code);
}

export async function createLinkRow(link: Omit<LinkRow, "createdAt" | "clicks" | "clickHistory">): Promise<LinkRow> {
  const links = await readLinks();
  const newLink: LinkRow = {
    ...link,
    createdAt: new Date().toISOString(),
    clicks: 0,
    clickHistory: [],
  };
  links.push(newLink);
  await writeLinks(links);
  return newLink;
}

export async function recordClick(code: string, clickData: Omit<LinkRow["clickHistory"][0], "timestamp">): Promise<LinkRow | undefined> {
  const links = await readLinks();
  const target = links.find((l) => l.code === code);
  if (!target) return undefined;

  target.clicks += 1;
  target.clickHistory = [
    ...target.clickHistory,
    { ...clickData, timestamp: new Date().toISOString() },
  ];

  if (target.clickHistory.length > 1000) {
    target.clickHistory = target.clickHistory.slice(-1000);
  }

  await writeLinks(links);
  return target;
}

export async function listRecent(limit = 50): Promise<LinkRow[]> {
  const all = await readLinks();
  return all.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, limit);
}

export async function getAnalytics(code: string) {
  const link = await findByCode(code);
  if (!link) return null;

  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const clicks = link.clickHistory ?? [];

  const clicks24h = clicks.filter((c) => now.getTime() - new Date((c as any).timestamp).getTime() < oneDay).length;
  const clicks7d = clicks.filter((c) => now.getTime() - new Date((c as any).timestamp).getTime() < oneWeek).length;

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
