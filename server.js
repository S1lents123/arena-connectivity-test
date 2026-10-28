const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Arena.ai connectivity tester",
    test: "/test"
  });
});

app.get("/test", async (req, res) => {
  let browser;

  try {
    console.log("[TEST] Launching Chromium...");

    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    const context = await browser.newContext({
      viewport: {
        width: 1366,
        height: 768
      }
    });

    const page = await context.newPage();

    console.log("[TEST] Opening Arena.ai...");

    const response = await page.goto(
      "https://arena.ai/",
      {
        waitUntil: "domcontentloaded",
        timeout: 60000
      }
    );

    await page.waitForTimeout(5000);

    const title = await page.title();
    const html = await page.content();
    const status = response?.status() || null;

    const cloudflareChallenge =
      html.includes("cf-challenge") ||
      html.includes("challenge-platform") ||
      html.includes("Just a moment");

    const result = {
      success: status === 200 && !cloudflareChallenge,
      httpStatus: status,
      finalUrl: page.url(),
      title,
      cloudflareChallenge,
      htmlLength: html.length,
      browser: "Chromium",
      hosting: "Render"
    };

    console.log("[RESULT]", result);

    res.json(result);

  } catch (error) {
    console.error("[ERROR]", error.message);

    res.status(500).json({
      success: false,
      error: error.message
    });

  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
