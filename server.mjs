import { createServer } from "node:http";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT || 3000);
const TARGET = "https://arena.ai/";

function detectChallenge(html, title) {
  return /just a moment|cf-chl|checking your browser|challenge-platform/i.test(
    html + " " + title
  );
}

function getCloudflareHeaders(headers) {
  const names = [
    "cf-ray",
    "cf-cache-status",
    "cf-mitigated",
    "server",
    "content-type",
    "retry-after"
  ];

  return Object.fromEntries(
    names
      .map(name => [name, headers[name]])
      .filter(([, value]) => value !== undefined)
  );
}

createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.url === "/") {
    res.end(JSON.stringify({
      status: "ready",
      endpoints: ["/test", "/browser", "/diagnostics"]
    }));
    return;
  }

  if (req.url === "/test") {
    try {
      const response = await fetch(TARGET, {
        signal: AbortSignal.timeout(15000),
        redirect: "follow"
      });

      const html = (await response.text()).slice(0, 100000);

      res.end(JSON.stringify({
        method: "fetch",
        httpStatus: response.status,
        finalUrl: response.url,
        cloudflareChallenge: detectChallenge(html, ""),
        accessible: response.ok && !detectChallenge(html, ""),
        cloudflareHeaders: getCloudflareHeaders(
          Object.fromEntries(response.headers)
        )
      }, null, 2));

    } catch (error) {
      res.end(JSON.stringify({
        accessible: false,
        error: error.message
      }));
    }

    return;
  }

  if (req.url === "/browser" || req.url === "/diagnostics") {
    let browser;

    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage"
        ]
      });

      const page = await browser.newPage({
        viewport: {
          width: 1366,
          height: 768
        }
      });

      const response = await page.goto(TARGET, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      const html = await page.content();
      const title = await page.title();

      const headers = response
        ? await response.allHeaders()
        : {};

      const challenge = detectChallenge(html, title);

      const result = {
        method: "playwright",
        httpStatus: response?.status() || null,
        finalUrl: page.url(),
        title,
        cloudflareChallenge: challenge,
        accessible: response?.ok() && !challenge,
        cloudflareHeaders: getCloudflareHeaders(headers),
        diagnostics: {
          htmlLength: html.length,
          userAgent: await page.evaluate(() => navigator.userAgent),
          browserVersion: browser.version(),
          timestamp: new Date().toISOString()
        },
        hosting: "Render"
      };

      res.end(JSON.stringify(result, null, 2));

    } catch (error) {
      res.end(JSON.stringify({
        method: "playwright",
        accessible: false,
        error: error.message
      }));

    } finally {
      if (browser) {
        await browser.close();
      }
    }

    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found" }));

}).listen(PORT, "0.0.0.0", () => {
  console.log(`Cloudflare diagnostics server running on ${PORT}`);
});
