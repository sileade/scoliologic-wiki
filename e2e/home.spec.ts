import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Home Page
 */
test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the main title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Corporate Knowledge Base");
  });

  test("should display key features section", async ({ page }) => {
    await expect(page.getByText("Key Features")).toBeVisible();
  });

  test("should have navigation links", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Wiki" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Search" })).toBeVisible();
  });

  test("should navigate to wiki page", async ({ page }) => {
    await page.getByRole("link", { name: "Wiki" }).click();
    await expect(page).toHaveURL(/\/wiki/);
  });

  test("should navigate to search page", async ({ page }) => {
    await page.getByRole("link", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/search/);
  });

  test("should have Browse Wiki button", async ({ page }) => {
    const browseButton = page.getByRole("link", { name: /Browse Wiki/i });
    await expect(browseButton).toBeVisible();
  });

  test("should display AI-powered description", async ({ page }) => {
    await expect(page.getByText(/AI-powered/i)).toBeVisible();
  });
});
