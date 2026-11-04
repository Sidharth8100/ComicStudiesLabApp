import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// This suite exercises the product scenes against the same real API as the reader.
test("3D cover works with keyboard controls, feature tabs, and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const sculpture = page.locator(".sc-sculpture");
  await expect(sculpture).toHaveClass(/is-ready|is-fallback/);
  const stage = page.getByRole("img", {
    name: "Interactive three-dimensional comic book",
  });
  const before = await stage.screenshot();
  await page
    .getByRole("button", { name: "Rotate book right", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "Book rotated right" }),
  ).toBeVisible();
  await expect
    .poll(async () => !(await stage.screenshot()).equals(before))
    .toBe(true);
  const rotated = await stage.screenshot();
  await page.getByRole("button", { name: "Reset book view" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Book view reset" }),
  ).toBeVisible();
  await expect
    .poll(async () => !(await stage.screenshot()).equals(rotated))
    .toBe(true);
  const pages = page.getByRole("tab", { name: "Feel the page" });
  await pages.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Hear the cast" })).toBeFocused();
  await expect(
    page.getByRole("tabpanel", { name: "Hear the cast" }),
  ).toContainText("Same character.");
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tabpanel", { name: "Find your focus" }),
  ).toContainText("Your whole attention.");
  await page.keyboard.press("Home");
  await expect(pages).toHaveAttribute("aria-selected", "true");
  const movingDecorations = await page
    .locator(".sc-experience")
    .evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
    );
  expect(movingDecorations).toBe(0);
  await page.getByRole("button", { name: "Step inside the reader" }).click();
  await expect(
    page.getByRole("heading", {
      name: "After the Light",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(errors).toEqual([]);
});

test("mobile navigation reaches bookmarks and library without losing the import flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await expect(
    page.getByRole("button", { name: "Close navigation" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Bookmarks", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole("button", { name: "Bookmarks", exact: true }).click();
  await expect(page.locator(".breadcrumb")).toContainText("Bookmarks");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Your library", exact: true }).click();
  await expect(page.locator(".breadcrumb")).toContainText("My library");
  await expect(
    page.getByRole("textbox", { name: "Search your library" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Import PDF", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("voice studio plays the displayed Echo sentence using real generated audio", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Echo/ }).click();
  const demo = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/demo") &&
      response.request().method() === "POST",
  );
  const speech = page.waitForResponse(
    (response) =>
      response.url().includes("/speech/") && response.status() === 200,
  );
  await page.getByRole("button", { name: "Preview Echo voice" }).click();
  const book = await (await demo).json();
  const displayedLine = book.pages
    .flatMap(
      (p: { lines: { id: string; text: string; character: string }[] }) =>
        p.lines,
    )
    .find(
      (line: { text: string; character: string }) =>
        line.character === "CHAR-02" &&
        line.text === "One small light can change everything!",
    );
  const response = await speech;
  expect(response.url()).toContain(`/speech/${displayedLine.id}`);
  expect(response.headers()["content-type"]).toContain("audio/wav");
  expect(Number(response.headers()["content-length"])).toBeGreaterThan(4000);
  await expect(page.locator(".sc-preview-status")).toContainText(
    "Playing Echo’s sample narration.",
  );
  await page.getByRole("tab", { name: /Nova/ }).click();
  await expect(
    page.getByRole("button", { name: "Pause voice preview" }),
  ).toHaveCount(0);
  await expect(page.locator(".sc-preview-status")).toHaveText(
    "Ready to hear Nova.",
  );
});

for (const theme of ["Midnight", "High contrast"]) {
  test(`discovery and interactive scenes remain accessible in ${theme}`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Reading preferences", exact: true })
      .click();
    await page.getByRole("button", { name: theme, exact: true }).click();
    await page.getByLabel("Reduce motion").check();
    await page
      .getByRole("button", { name: "Make yourself comfortable" })
      .click();
    await page.getByRole("tab", { name: "Hear the cast" }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  });
}

test("a device without WebGL keeps an interactive cover and a working reader", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const context = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: string,
      ...args: unknown[]
    ) {
      if (
        kind === "webgl" ||
        kind === "webgl2" ||
        kind === "experimental-webgl"
      )
        return null;
      return context.apply(this, [kind, ...args] as Parameters<typeof context>);
    } as typeof context;
  });
  await page.goto("/");
  await expect(page.locator(".sc-sculpture")).toHaveClass(/is-fallback/);
  const cover = page.locator(".sc-book-poster");
  await expect(cover.locator("img")).toBeVisible();
  const original = await cover.evaluate(
    (node) => getComputedStyle(node).transform,
  );
  await page.getByRole("button", { name: "Rotate book left" }).click();
  await expect
    .poll(() => cover.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe(original);
  await page.getByRole("button", { name: "Reset book view" }).click();
  await expect
    .poll(() => cover.evaluate((node) => getComputedStyle(node).transform))
    .toBe(original);
  await page.getByRole("button", { name: "Explore a story" }).click();
  await expect(page.locator(".flip-host canvas")).toBeVisible();
});
