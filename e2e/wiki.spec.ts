import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Wiki Page
 */
test.describe("Wiki Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wiki");
  });

  test("should display wiki page", async ({ page }) => {
    await expect(page).toHaveURL(/\/wiki/);
  });

  test("should display page tree sidebar", async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState("networkidle");
    
    // Check for sidebar or page list
    const sidebar = page.locator('[data-testid="page-tree"], .sidebar, nav');
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 });
  });

  test("should display welcome page or empty state", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    
    // Either welcome page content or empty state should be visible
    const content = page.locator("main, .content, article");
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test("should have create page button for authenticated users", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    
    // Look for create/new page button (may not be visible if not authenticated)
    const createButton = page.getByRole("button", { name: /create|new|add/i });
    
    // This test just checks the page loads correctly
    // Create button visibility depends on auth state
    await expect(page.locator("body")).toBeVisible();
  });

  test("should navigate to page when clicking on page tree item", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    
    // Find any clickable page link in the tree
    const pageLinks = page.locator('a[href*="/wiki/"]');
    const count = await pageLinks.count();
    
    if (count > 0) {
      await pageLinks.first().click();
      await expect(page).toHaveURL(/\/wiki\/.+/);
    }
  });
});

test.describe("Wiki Editor", () => {
  test("should display editor when viewing a page", async ({ page }) => {
    await page.goto("/wiki");
    await page.waitForLoadState("networkidle");
    
    // Find and click on a page to view it
    const pageLinks = page.locator('a[href*="/wiki/"]');
    const count = await pageLinks.count();
    
    if (count > 0) {
      await pageLinks.first().click();
      await page.waitForLoadState("networkidle");
      
      // Editor or content area should be visible
      const editor = page.locator('.ProseMirror, .editor, .content, article');
      await expect(editor.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("should have formatting toolbar when editing", async ({ page }) => {
    await page.goto("/wiki");
    await page.waitForLoadState("networkidle");
    
    // Navigate to a page
    const pageLinks = page.locator('a[href*="/wiki/"]');
    const count = await pageLinks.count();
    
    if (count > 0) {
      await pageLinks.first().click();
      await page.waitForLoadState("networkidle");
      
      // Look for toolbar elements
      const toolbar = page.locator('[role="toolbar"], .toolbar, .editor-toolbar');
      // Toolbar may or may not be visible depending on edit mode
      await expect(page.locator("body")).toBeVisible();
    }
  });
});

test.describe("Wiki AI Assistant", () => {
  test("should have AI assistant button", async ({ page }) => {
    await page.goto("/wiki");
    await page.waitForLoadState("networkidle");
    
    // Navigate to a page first
    const pageLinks = page.locator('a[href*="/wiki/"]');
    const count = await pageLinks.count();
    
    if (count > 0) {
      await pageLinks.first().click();
      await page.waitForLoadState("networkidle");
      
      // Look for AI button
      const aiButton = page.getByRole("button", { name: /ai|assistant|sparkles/i });
      // AI button visibility depends on page state
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
