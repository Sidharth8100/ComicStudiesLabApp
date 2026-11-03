import { test, expect } from "@playwright/test";

test("Pages-style subpath build connects to a separate backend and renders an uploaded PDF", async ({
  page,
}) => {
  test.skip(
    !process.env.PANEL_STATIC_URL,
    "Requires a separately served Pages build and a configured backend origin",
  );
  const apiRequests: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/"))
      apiRequests.push(r.url());
  });
  await page.goto(process.env.PANEL_STATIC_URL!);
  await expect(
    page.getByRole("heading", { name: /Every panel/ }),
  ).toBeVisible();
  await expect(page.locator(".hero-book img")).toBeVisible();
  await page.getByRole("button", { name: /Import your comic/ }).click();
  const uploaded = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/books" &&
      r.request().method() === "POST" &&
      r.status() === 202,
  );
  await page.locator("input[type=file]").setInputFiles("/tmp/panel-e2e.pdf");
  const response = await uploaded;
  const origin = new URL(response.url()).origin;
  const book = await response.json();
  await expect(
    page.getByRole("heading", { name: "panel-e2e", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".flip-host canvas")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Listen to Ada: Hello from the uploaded comic/,
    }),
  ).toBeVisible();
  expect(apiRequests.length).toBeGreaterThan(0);
  expect(
    apiRequests.every(
      (url) =>
        new URL(url).origin === origin && !new URL(url).pathname.includes("//"),
    ),
  ).toBe(true);
  const status = await page.evaluate(
    async ({ origin, id }) =>
      (
        await fetch(origin + "/api/books/" + id, {
          method: "DELETE",
          headers: {
            Authorization:
              "Bearer " + localStorage.getItem("panel-library-key"),
          },
        })
      ).status,
    { origin, id: book.id },
  );
  expect(status).toBe(204);
});
