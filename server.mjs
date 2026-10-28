import { createServer } from "node:http";
import { chromium } from "playwright";

const port = Number(process.env.PORT || 3000);

createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.url === "/") {
    res.end(JSON.stringify({
      status: "ready",
      endpoints: {
        http: "/test",
        browser: "/browser"
      }
    }));
    return;
  }

  // Original HTTP connectivity test
  if (req.url === "/test") {
    try {
      const response = await fetch("https://arena.ai/", {
        signal: AbortSignal.timeout(15000),
        redirect: "follow"
      });

      const body = (await response.text()).slice(0, 100000);

      const challenge =
        /just a moment|cf-chl|checking your browser/i.test(body);

      res.end(JSON.stringify({
        method: "fetch",
        httpStatus: response.status,
        finalUrl: response.url.split("?")[0],
        cloudflareChallenge: challenge,
        accessible: response.ok && !challenge
      }));

    } catch (error) {
      res.end(JSON.stringify({
        method: "fetch",
        accessible: false,
        error: error.message
      }));
    }

    return;
  }

  // Chromium browser connectivity test
  if (req.url === "/browser") {
    let browser;

    try {
      console.log("[BROWSER] Launching Chromium...");

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

      console.log("[BROWSER] Visiting Arena.ai...");

      const response = await page.goto("https://arena.ai/", {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      const html = await page.content();

      const challenge =
        /just a moment|cf-chl|checking your browser|challenge-platform/i.test(html);

      res.end(JSON.stringify({
        method: "playwright",
        httpStatus: response?.status() || null,
        finalUrl: page.url(),
        title: await page.title(),
        cloudflareChallenge: challenge,
        accessible: response?.ok() && !challenge,
        htmlLength: html.length,
        browser: "Chromium",
        hosting: "Render"
      }));

    } catch (error) {
      console.error("[BROWSER ERROR]", error);

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

}).listen(port, "0.0.0.0", () => {
  console.log(`Test server listening on ${port}`);
});
