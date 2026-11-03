import { test, expect } from "@playwright/test";
import path from "node:path";
const artifact = (name: string) =>
  path.join(process.env.PANEL_ARTIFACT_DIR || "test-results/visuals", name);

test("library, animated reader, cast editing, accessibility and keyboard navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every panel/ }),
  ).toBeVisible();
  await page.screenshot({ path: artifact("library.png"), fullPage: true });
  await page.getByRole("button", { name: "Explore a story" }).click();
  await expect(
    page.getByRole("heading", { name: "After the Light", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".flip-host canvas")).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByLabel("Comic page", { exact: true })).toHaveValue("2");
  await expect(
    page.getByRole("button", { name: /Listen to Nova: The city/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "The cast 3" }).click();
  await page.getByRole("button", { name: /Nova CHAR-01/ }).click();
  await page.getByLabel("Character name", { exact: true }).fill("Nova Star");
  await page
    .getByRole("combobox", { name: "Voice", exact: true })
    .selectOption("soft");
  await page.getByRole("button", { name: "Save character" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /Nova Star CHAR-01/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reading preferences", exact: true })
    .click();
  await page.getByLabel("Larger transcript").check();
  await page.getByLabel("Simple page view").check();
  await page.getByRole("button", { name: "High contrast" }).click();
  await page.getByRole("button", { name: "Make yourself comfortable" }).click();
  await expect(page.locator(".simple-page img")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "contrast");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Comic page", { exact: true })).toHaveValue("3");
  await page.getByRole("button", { name: "Story audio" }).click();
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause narration", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".transcript-line.speaking")).toBeVisible();
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
  await page.screenshot({ path: artifact("reader.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("mobile reading layout and upload validation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Import your comic/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "oops.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a real PDF"),
  });
  await expect(page.getByRole("alert")).toContainText("not a readable PDF");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page.getByRole("button", { name: "Explore a story" }).click();
  await expect(page.locator(".flip-host canvas")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({ path: artifact("mobile.png"), fullPage: true });
});

test("PDF upload completes, extracted dialogue is editable, and private media loads", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Import your comic/ }).click();
  await page.locator("input[type=file]").setInputFiles("/tmp/panel-e2e.pdf");
  await expect(
    page.getByRole("heading", { name: "panel-e2e", exact: true, level: 1 }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole("button", {
      name: /Listen to Ada: Hello from the uploaded comic/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit dialogue 1" }).click();
  await page
    .getByRole("textbox", { name: "Dialogue", exact: true })
    .fill("A new adventure awaits!");
  await page
    .getByRole("combobox", { name: "Emotion", exact: true })
    .selectOption("excited");
  await page.getByRole("button", { name: "Save dialogue" }).click();
  await expect(
    page.getByRole("button", { name: /Listen to Ada: A new adventure awaits/ }),
  ).toBeVisible();
});

test("a missed character can be created and assigned to dialogue", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a story" }).click();
  await page.getByRole("button", { name: "The cast 3" }).click();
  await page.getByRole("button", { name: "Add character" }).click();
  await page
    .getByRole("textbox", { name: "Character name", exact: true })
    .fill("Comet");
  await page.getByRole("button", { name: "Save character" }).click();
  await expect(
    page.getByRole("button", { name: /Comet CHAR-03/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Story audio" }).click();
  await page.getByRole("button", { name: "Edit dialogue 1" }).click();
  await page
    .getByRole("combobox", { name: "Who’s speaking?", exact: true })
    .selectOption("CHAR-03");
  await page.getByRole("button", { name: "Save dialogue" }).click();
  await expect(
    page.getByRole("button", { name: /Listen to Comet: Some stories/ }),
  ).toBeVisible();
});
