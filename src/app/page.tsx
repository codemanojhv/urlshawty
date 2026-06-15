"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ShortResult = {
  shortUrl: string;
  originalUrl: string;
  shortCode: string;
  createdAt: string;
};

type SavedLink = {
  code: string;
  url: string;
  createdAt: string;
  clicks: number;
  ownerEmail?: string | null;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShortResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ShortResult[]>([]);
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([]);
  const [copied, setCopied] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [authUser, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const getToken = () => {
    try {
      const raw = document.cookie.match(/auth_token=([^;]+)/);
      if (!raw) return null;
      return raw[1].trim();
    } catch {
      return null;
    }
  };

  const loadSession = async () => {
    try {
      const response = await fetch("/api/auth", { cache: "no-store" });
      const data = await response.json();
      setAuthUser(data.user ?? null);
    } catch {
      setAuthUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const loadSavedLinks = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const response = await fetch("/api/me/links", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setSavedLinks(data.links ?? []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (authUser?.email) loadSavedLinks();
    else setSavedLinks([]);
  }, [authUser?.email]);

  const generateShortUrl = useCallback(async () => {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          customAlias: customAlias.trim() || undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to shorten URL");
      }

      const shortResult: ShortResult = {
        shortUrl: data.shortUrl,
        originalUrl: data.originalUrl,
        shortCode: data.shortCode,
        createdAt: new Date().toISOString(),
      };

      setResult(shortResult);
      setHistory((prev) => [shortResult, ...prev.slice(0, 9)]);
      if (authUser?.email) loadSavedLinks();
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [url, customAlias, authUser?.email]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        generateShortUrl();
      }
    },
    [generateShortUrl]
  );

  const base =
    process.env.NEXT_PUBLIC_BASE_URL || "https://urlshawtys.vercel.app";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 tracking-tight">
              urlshawtys
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <a
              href="#features"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Features
            </a>
            {!authLoading && !authUser && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900"
                onClick={() => {
                  const email = prompt("Enter email to login/register")?.trim() || "";
                  const password = prompt("Enter password") || "";
                  if (!email || !password) return;
                  fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mode: "register", email, password }),
                  })
                    .then((res) => res.json())
                    .then((data) => {
                      if (data.user) loadSession();
                    })
                    .catch(() => {});
                }}
              >
                Sign in / Register
              </Button>
            )}
            {!authLoading && authUser && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900"
                onClick={() => {
                  fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                    setAuthUser(null);
                    setSavedLinks([]);
                  });
                }}
              >
                Sign out
              </Button>
            )}
            {!authLoading && authUser && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900"
                onClick={loadSavedLinks}
              >
                Refresh saved links
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Hero Section */}
        <section className="pt-16 pb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
            Short links, <span className="text-slate-400">instantly</span>
          </h1>
          <p className="mt-4 text-lg text-slate-500 max-w-md mx-auto leading-relaxed">
            Paste any URL, get a clean short link with a QR code. No sign-up,
            no friction.
          </p>
        </section>

        {/* Shortener Card */}
        <section className="pb-16">
          <Card className="max-w-2xl mx-auto p-1 shadow-lg shadow-slate-200/50 border-slate-200/60">
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <label
                  htmlFor="url-input"
                  className="text-sm font-medium text-slate-700"
                >
                  Destination URL
                </label>
                <Input
                  id="url-input"
                  type="url"
                  placeholder="https://example.com/very-long-url..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className={cn(
                    "h-12 text-base border-slate-200 focus-visible:ring-slate-900/20",
                    error && "border-red-300 focus-visible:ring-red-200"
                  )}
                  aria-invalid={!!error}
                  aria-describedby={error ? "url-error" : undefined}
                />
                {error && (
                  <p id="url-error" className="text-sm text-red-600">
                    {error}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="alias-input"
                  className="text-sm font-medium text-slate-700"
                >
                  Custom alias{" "}
                  <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-sm">
                    urlshawtys.vercel.app/
                  </span>
                  <Input
                    id="alias-input"
                    type="text"
                    placeholder="my-custom-link"
                    value={customAlias}
                    onChange={(e) =>
                      setCustomAlias(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                          .slice(0, 30)
                      )
                    }
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    className="rounded-l-none h-12 border-slate-200 focus-visible:ring-slate-900/20"
                  />
                </div>
              </div>

              <Button
                onClick={generateShortUrl}
                disabled={loading || !url.trim()}
                className="w-full h-12 text-base font-medium bg-slate-900 hover:bg-slate-800 text-white"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    Shortening...
                  </span>
                ) : (
                  "Shorten URL"
                )}
              </Button>
            </div>
          </Card>
        </section>

        {/* Error Display */}
        {error && !result && (
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="p-4 border-red-200 bg-red-50/50">
              <p className="text-sm text-red-700">{error}</p>
            </Card>
          </div>
        )}

        {/* Result Section */}
        {result && (
          <section className="pb-16">
            <Card className="max-w-2xl mx-auto overflow-hidden shadow-lg shadow-slate-200/50 border-slate-200/60">
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Your short link
                    </p>
                    <a
                      href={result.shortUrl}
                      className="text-lg font-semibold text-slate-900 hover:text-slate-700 break-all block"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {result.shortUrl}
                    </a>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(result.shortUrl)}
                    className="shrink-0 border-slate-200"
                    aria-label="Copy short URL"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400 mb-1">Original URL</p>
                  <p className="text-sm text-slate-600 break-all">{result.originalUrl}</p>
                </div>

                {/* QR Code Section */}
                <div className="border-t border-slate-100 pt-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="shrink-0">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <QRCodeDisplay
                          url={result.shortUrl}
                          label="QR code for short link"
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="text-sm font-medium text-slate-900">
                        Scan to share
                      </p>
                      <p className="text-xs text-slate-500">
                        Works with any smartphone camera or QR reader app. High contrast for easy scanning.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <QRDownloadButton url={result.shortUrl} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* History / Saved Links Section */}
        {(savedLinks.length > 0 || history.length > 0 || authUser?.email) && (
          <section className="pb-20">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {authUser?.email ? `Saved links for ${authUser.email}` : "Recent links"}
            </h2>
            <div className="space-y-2 max-w-2xl">
              {(authUser?.email ? savedLinks : history).map((item) => {
                const shortUrl = item.shortUrl ?? `${base}/${item.code}`;
                const originalUrl = item.originalUrl ?? item.url;
                const key = item.shortCode ?? item.code;
                return (
                  <div
                    key={key + item.createdAt}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 bg-white hover:border-slate-200 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <a
                        href={shortUrl}
                        className="text-sm font-medium text-slate-900 hover:text-slate-700 block truncate"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {shortUrl}
                      </a>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {originalUrl}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(shortUrl)}
                        aria-label={`Copy ${shortUrl}`}
                      >
                        <CopyIcon />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Features Grid */}
        <section id="features" className="pb-24">
          <h2 className="text-2xl font-semibold text-slate-900 mb-8 text-center">
            Built for speed and simplicity
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <Feature
              icon={<LightningIcon />}
              title="Instant"
              description="Shorten any URL in one click. No sign-ups, no delays."
            />
            <Feature
              icon={<QRCodeIcon />}
              title="QR ready"
              description="Every link gets a downloadable QR code. Scan. Share. Done."
            />
            <Feature
              icon={<LockIcon />}
              title="Minimal"
              description="Clean interface with no trackers, no clutter, just links."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200/60 py-8 text-center">
          <p className="text-sm text-slate-400">
            urlshawtys.vercel.app · Fast, accessible URL shortening
          </p>
        </footer>
      </main>
    </div>
  );
}

function QRCodeDisplay({ url, label }: { url: string; label: string }) {
  return (
    <div className="relative">
      <QRCodeSVG
        value={url}
        size={160}
        level="H"
        bgColor="#ffffff"
        fgColor="#0f172a"
        marginSize={2}
        aria-label={label}
        role="img"
        title={label}
        data-qr-svg
      />
    </div>
  );
}

function QRDownloadButton({ url }: { url: string }) {
  const [open, setOpen] = useState(false);

  const downloadSVG = () => {
    const svgEl = document.querySelector("[data-qr-svg]") as SVGSVGElement | null;
    if (!svgEl) return;
    const data = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qrcode.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadPNG = () => {
    const svgEl = document.querySelector("[data-qr-svg]") as SVGSVGElement | null;
    if (!svgEl) return;
    const data = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 800, 800);
      ctx.drawImage(img, 0, 0, 800, 800);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "qrcode.png";
        a.click();
        URL.revokeObjectURL(a.href);
      });
    };
    img.src = "data:image/svg+xml;base64," + btoa(data);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        className="border-slate-200 text-slate-700"
      >
        <DownloadIcon className="w-4 h-4 mr-1.5" />
        Download QR
      </Button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700"
            onClick={() => { downloadPNG(); setOpen(false); }}
            role="menuitem"
          >
            PNG (800×800)
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700"
            onClick={() => { downloadSVG(); setOpen(false); }}
            role="menuitem"
          >
            SVG
          </button>
        </div>
      )}
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-5 rounded-xl border border-slate-100 bg-white">
      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 mb-3">
        {icon}
      </div>
      <p className="font-medium text-slate-900 text-sm mb-1">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="w-4 h-4 text-slate-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function DownloadIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={cn("w-4 h-4", className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function QRCodeIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
      <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
      <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
      <rect x="14" y="14" width="3" height="3" rx="0.5" strokeWidth={2} />
      <rect x="18" y="14" width="3" height="3" rx="0.5" strokeWidth={2} />
      <rect x="14" y="18" width="3" height="3" rx="0.5" strokeWidth={2} />
      <rect x="18" y="18" width="3" height="3" rx="0.5" strokeWidth={2} />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}
