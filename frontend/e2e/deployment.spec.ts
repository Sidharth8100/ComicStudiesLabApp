import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("real narration advances to the next page and pause stops playback", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a story" }).click();
  await page
    .getByRole("combobox", { name: "Narration speed" })
    .selectOption("2");
  const audio = page.waitForResponse(
    (r) => r.url().includes("/speech/") && r.status() === 200,
  );
  await page
    .getByRole("button", { name: "Play narration", exact: true })
    .click();
  await audio;
  await expect(
    page.getByRole("slider", { name: "Comic page", exact: true }),
  ).toHaveValue("2", { timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "Pause narration", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause narration", exact: true })
    .click();
  await expect(page.locator(".transcript-line.speaking")).toHaveCount(0);
  await page.getByRole("slider", { name: "Comic page", exact: true }).fill("3");
  await expect(
    page.getByRole("button", { name: /Listen to Nova: Do you really think/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "Comic page", exact: true }),
  ).toHaveValue("4");
});

test("transcript downloads and reading position survives returning to the library", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a story" }).click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download transcript" }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("After the Light transcript.txt");
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString();
  expect(text).toContain("Nova: The city forgot how to dream.");
  expect(text).toContain("Echo: One small light can change everything!");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Explore a story" }).click();
  await expect(
    page.getByRole("slider", { name: "Comic page", exact: true }),
  ).toHaveValue("2");
});

test("reader fits after a desktop-to-mobile viewport change", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a story" }).click();
  await expect(page.locator(".flip-host canvas")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const box = await page.locator(".flip-host canvas").boundingBox();
      return !!box && box.x >= -1 && box.x + box.width <= 391;
    })
    .toBe(true);
});

test("damaged local reading state does not prevent opening a comic", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("panel-bookmarks", "{broken");
    localStorage.setItem("panel-progress-sample", "not-a-number");
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every panel/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore a story" }).click();
  await expect(
    page.getByRole("slider", { name: "Comic page", exact: true }),
  ).toHaveValue("1");
  expect(errors).toEqual([]);
});

for (const theme of ["Midnight", "High contrast"]) {
  test(`reader and dialogs meet automated contrast rules in ${theme}`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore a story" }).click();
    await expect(page.locator(".reader-topbar")).toBeVisible();
    await page
      .locator(".reader-topbar")
      .getByRole("button", { name: "Reading preferences", exact: true })
      .click();
    await page.getByRole("button", { name: theme, exact: true }).click();
    let results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
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
    await page
      .getByRole("button", { name: "Make yourself comfortable" })
      .click();
    results = await new AxeBuilder({ page })
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

test("28 distinct voices, 13 expressions and a cross-page character merge", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore a story" }).click();
  await expect(page.locator(".reader-topbar")).toBeVisible();
  await page.getByRole("button", { name: "The cast 3" }).click();
  await page.getByRole("button", { name: /Nova CHAR-01/ }).click();
  const voices = page.getByRole("combobox", { name: "Voice", exact: true });
  await expect(voices.locator("option")).toHaveCount(28);
  await expect(voices.locator('option[value="warm"]')).toHaveAttribute(
    "disabled",
    "",
  );
  await voices.selectOption("nova");
  await page.getByRole("button", { name: "Save character" }).click();
  await page.getByRole("button", { name: /Echo CHAR-02/ }).click();
  await page
    .getByRole("combobox", { name: "Merge into character" })
    .selectOption("CHAR-01");
  await page
    .getByRole("button", { name: "Merge character across all pages" })
    .click();
  await expect(page.getByRole("button", { name: "The cast 2" })).toBeVisible();
  await page.getByRole("button", { name: "Story audio" }).click();
  await page.getByRole("slider", { name: "Comic page", exact: true }).fill("2");
  await expect(
    page.getByRole("button", { name: /Listen to Nova: Maybe it just needs/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit dialogue 1" }).click();
  await expect(
    page
      .getByRole("combobox", { name: "Emotion", exact: true })
      .locator("option"),
  ).toHaveCount(13);
  await page
    .getByRole("combobox", { name: "Emotion", exact: true })
    .selectOption("fearful");
  await page.getByRole("button", { name: "Save dialogue" }).click();
  await expect(page.locator(".speaker-heading small").first()).toHaveText(
    "fearful",
  );
});

test("uploaded named characters receive age/presentation voice cues and sentiment consistently", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Import your comic/ }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles("/tmp/panel-casting-e2e.pdf");
  await expect(
    page.getByRole("heading", {
      name: "panel-casting-e2e",
      exact: true,
      level: 1,
    }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".speaker-heading small").first()).toHaveText(
    "fearful",
  );
  await page.getByRole("button", { name: "The cast 2" }).click();
  await page.getByRole("button", { name: /Grandpa CHAR-01/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Age cue", exact: true }),
  ).toHaveValue("older adult");
  await expect(
    page.getByRole("combobox", { name: "Presentation", exact: true }),
  ).toHaveValue("masculine");
  await expect(
    page.getByRole("combobox", { name: "Voice", exact: true }),
  ).toHaveValue("deep");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await page.getByRole("button", { name: /Grandpa CHAR-01/ }).click();
  await expect(
    page.getByRole("combobox", { name: "Voice", exact: true }),
  ).toHaveValue("deep");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Story audio" }).click();
  await expect(page.locator(".speaker-heading small").first()).toHaveText(
    "hopeful",
  );
});

test("changing a character voice replaces browser-cached narration", async ({
  page,
}) => {
  await page.goto("/");
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/demo") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Explore a story" }).click();
  const book = await (await response).json();
  const speech = `/api/books/${book.id}/speech/${book.pages[0].lines[0].id}`;
  const digest = () =>
    page.evaluate(async (path) => {
      const r = await fetch(path, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("panel-library-key"),
        },
      });
      if (!r.ok) throw Error("Speech request failed");
      const data = await r.arrayBuffer();
      const hash = await crypto.subtle.digest("SHA-256", data);
      return {
        hash: Array.from(new Uint8Array(hash), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
        cache: r.headers.get("cache-control"),
      };
    }, speech);
  const before = await digest();
  await page.getByRole("button", { name: "The cast 3" }).click();
  await page.getByRole("button", { name: /Narrator NARRATOR/ }).click();
  await page
    .getByRole("combobox", { name: "Voice", exact: true })
    .selectOption("onyx");
  await page.getByRole("button", { name: "Save character" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const after = await digest();
  expect(after.hash).not.toBe(before.hash);
  expect(after.cache).toContain("no-store");
});
