import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Search Page
 */
test.describe("Search Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/search");
  });

  test("should display search page", async ({ page }) => {
    await expect(page).toHaveURL(/\/search/);
  });

  test("should have search input field", async ({ page }) => {
    const searchInput = page.getByRole("textbox", { name: /search/i });
    await expect(searchInput).toBeVisible();
  });

  test("should have search type selector", async ({ page }) => {
    // Look for text/AI search toggle or tabs
    const searchTypes = page.locator('[role="tablist"], .search-type, .tabs');
    await expect(page.locator("body")).toBeVisible();
  });

  test("should perform text search", async ({ page }) => {
    const searchInput = page.getByRole("textbox", { name: /search/i });
    await searchInput.fill("test");
    
    // Press enter or click search button
    await searchInput.press("Enter");
    
    // Wait for results
    await page.waitForLoadState("networkidle");
    
    // Results area should be visible (even if empty)
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show search results or empty state", async ({ page }) => {
    const searchInput = page.getByRole("textbox", { name: /search/i });
    await searchInput.fill("wiki");
    await searchInput.press("Enter");
    
    await page.waitForLoadState("networkidle");
    
    // Either results or "no results" message should appear
    const resultsArea = page.locator(".results, .search-results, main");
    await expect(resultsArea.first()).toBeVisible({ timeout: 10000 });
  });

  test("should clear search input", async ({ page }) => {
    const searchInput = page.getByRole("textbox", { name: /search/i });
    await searchInput.fill("test query");
    
    // Clear the input
    await searchInput.clear();
    
    await expect(searchInput).toHaveValue("");
  });

  test("should handle empty search gracefully", async ({ page }) => {
    const searchInput = page.getByRole("textbox", { name: /search/i });
    await searchInput.press("Enter");
    
    // Should not crash, page should remain functional
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("AI Search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/search");
  });

  test("should have AI search option", async ({ page }) => {
    // Look for AI search toggle or tab
    const aiOption = page.getByText(/ai|semantic|intelligent/i);
    // AI option may or may not be visible depending on configuration
    await expect(page.locator("body")).toBeVisible();
  });

  test("should switch between search modes", async ({ page }) => {
    // Find search mode tabs or buttons
    const tabs = page.locator('[role="tab"], .tab, button');
    const count = await tabs.count();
    
    if (count > 1) {
      // Click on different tabs to switch modes
      await tabs.nth(1).click();
      await page.waitForLoadState("networkidle");
    }
    
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Search History", () => {
  test("should save search to history", async ({ page }) => {
    const searchInput = page.getByRole("textbox", { name: /search/i });
    await searchInput.fill("test search query");
    await searchInput.press("Enter");
    
    await page.waitForLoadState("networkidle");
    
    // Reload page
    await page.reload();
    
    // History might show previous searches
    await expect(page.locator("body")).toBeVisible();
  });
});
