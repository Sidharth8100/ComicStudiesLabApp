import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Opt in only against the intended running service. Each run creates its own
// capability key and deletes only the synthetic comics created by this test.
test("hosted discovery, PDF import, private media and real narration work together", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.PANEL_PUBLIC_CHECK !== "1",
    "Set PANEL_PUBLIC_CHECK=1 to verify a running full-stack deployment.",
  );
  test.setTimeout(180000);
  const errors: string[] = [];
  const books: string[] = [];
  let authorization = "";
  let origin = "";
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Every panel/ }),
    ).toBeVisible();
    await expect(page.locator(".sc-sculpture")).toHaveClass(
      /is-ready|is-fallback/,
    );
    const key = await page.evaluate(() =>
      localStorage.getItem("panel-library-key"),
    );
    if (!key || !/^[a-f0-9]{64}$/.test(key))
      throw Error("The browser did not create a private library.");
    authorization = `Bearer ${key}`;
    const discovery = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      discovery.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);

    const sampleResponse = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/demo" &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Explore a story" }).click();
    const response = await sampleResponse;
    expect(response.status()).toBe(200);
    origin = new URL(response.url()).origin;
    books.push((await response.json()).id);
    await expect(
      page.getByRole("heading", {
        name: "After the Light",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.locator(".flip-host canvas")).toBeVisible();
    await page
      .getByRole("combobox", { name: "Narration speed" })
      .selectOption("2");
    const speech = page.waitForResponse(
      (r) => r.url().includes("/speech/") && r.status() === 200,
    );
    await page
      .getByRole("button", { name: "Play narration", exact: true })
      .click();
    expect((await speech).headers()["content-type"]).toContain("audio/wav");
    await expect(
      page.getByRole("slider", { name: "Comic page", exact: true }),
    ).toHaveValue("2", { timeout: 30000 });
    await page
      .getByRole("button", { name: "Pause narration", exact: true })
      .click();
    await page.getByRole("button", { name: "Library", exact: true }).click();

    await page
      .getByRole("button", { name: "Import your comic", exact: true })
      .click();
    const uploadResponse = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/books" &&
        r.request().method() === "POST",
    );
    await page.locator("input[type=file]").setInputFiles("/tmp/panel-e2e.pdf");
    const uploaded = await uploadResponse;
    expect(uploaded.status()).toBe(202);
    books.push((await uploaded.json()).id);
    await expect(
      page.getByRole("heading", { name: "panel-e2e", exact: true, level: 1 }),
    ).toBeVisible({ timeout: 120000 });
    await expect(
      page.getByRole("button", {
        name: /Listen to Ada: Hello from the uploaded comic/,
      }),
    ).toBeVisible();
    await expect(page.locator(".flip-host canvas")).toBeVisible();
    const uploadedSpeech = page.waitForResponse(
      (r) => r.url().includes("/speech/") && r.status() === 200,
    );
    await page
      .getByRole("button", { name: "Play narration", exact: true })
      .click();
    expect((await uploadedSpeech).headers()["cache-control"]).toContain(
      "no-store",
    );
    await page
      .getByRole("button", { name: "Pause narration", exact: true })
      .click();

    await page
      .getByRole("button", { name: "Reading preferences", exact: true })
      .click();
    await page.getByLabel("Simple page view").check();
    await page
      .getByRole("button", { name: "High contrast", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Make yourself comfortable" })
      .click();
    await expect(page.locator(".simple-page img")).toBeVisible();
    const reader = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      reader.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    for (const id of books) {
      const removed = await request.delete(`${origin}/api/books/${id}`, {
        headers: { Authorization: authorization },
      });
      expect(removed.status(), "Delete this run's synthetic comic").toBe(204);
    }
  }
});
