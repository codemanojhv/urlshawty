const API_BASE = "https://urlshawtys.vercel.app";

const currentUrlEl = document.getElementById("currentUrl");
const codeInput = document.getElementById("code");
const shortenBtn = document.getElementById("shortenBtn");
const errorEl = document.getElementById("error");
const resultEl = document.getElementById("result");
const resultUrlEl = document.getElementById("resultUrl");
const copyBtn = document.getElementById("copyBtn");

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.add("show");
  setTimeout(() => {
    errorEl.classList.remove("show");
  }, 4000);
}

function showResult(url) {
  resultUrlEl.textContent = url;
  resultEl.classList.add("show");
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function shortenUrl(url, customCode) {
  shortenBtn.disabled = true;
  shortenBtn.textContent = "Shortening...";
  errorEl.classList.remove("show");
  resultEl.classList.remove("show");

  try {
    const response = await fetch(`${API_BASE}/api/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url,
        customAlias: customCode || undefined,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    showResult(data.shortUrl);
    codeInput.value = "";
  } catch (error) {
    showError(error.message || "Failed to shorten URL");
  } finally {
    shortenBtn.disabled = false;
    shortenBtn.textContent = "Shorten URL";
  }
}

copyBtn.addEventListener("click", async () => {
  const url = resultUrlEl.textContent;
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy to clipboard";
    }, 2000);
  } catch (error) {
    showError("Failed to copy");
  }
});

shortenBtn.addEventListener("click", async () => {
  const tab = await getCurrentTab();
  const url = tab.url;

  if (!url || url.startsWith("chrome://")) {
    showError("Cannot shorten this page");
    return;
  }

  currentUrlEl.textContent = url;
  const customCode = codeInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
  await shortenUrl(url, customCode);
});

codeInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    shortenBtn.click();
  }
});

getCurrentTab().then((tab) => {
  const url = tab.url;
  if (url && !url.startsWith("chrome://")) {
    currentUrlEl.textContent = url;
  } else {
    currentUrlEl.textContent = "Open a webpage to shorten";
    shortenBtn.disabled = true;
  }
});
