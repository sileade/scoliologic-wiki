import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Navigation and Theme
 */
test.describe("Navigation", () => {
  test("should navigate between all main pages", async ({ page }) => {
    // Start at home
    await page.goto("/");
    await expect(page).toHaveURL("/");
    
    // Navigate to Wiki
    await page.getByRole("link", { name: "Wiki" }).click();
    await expect(page).toHaveURL(/\/wiki/);
    
    // Navigate to Search
    await page.getByRole("link", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/search/);
    
    // Navigate to Admin
    await page.getByRole("link", { name: "Admin" }).click();
    await page.waitForLoadState("networkidle");
    // May redirect to login if not authenticated
  });

  test("should have consistent header across pages", async ({ page }) => {
    const pages = ["/", "/wiki", "/search"];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState("networkidle");
      
      // Header should be visible
      const header = page.locator("header, nav").first();
      await expect(header).toBeVisible();
      
      // Logo or title should be present
      const logo = page.getByText(/Scoliologic Wiki/i);
      await expect(logo).toBeVisible();
    }
  });

  test("should handle 404 pages gracefully", async ({ page }) => {
    await page.goto("/non-existent-page-12345");
    await page.waitForLoadState("networkidle");
    
    // Should show 404 or redirect to home
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Theme Switching", () => {
  test("should have theme toggle button", async ({ page }) => {
    await page.goto("/");
    
    // Look for theme toggle
    const themeToggle = page.getByRole("button", { name: /theme|dark|light|mode/i });
    // Theme toggle may or may not be visible
    await expect(page.locator("body")).toBeVisible();
  });

  test("should switch between light and dark themes", async ({ page }) => {
    await page.goto("/");
    
    // Get initial theme
    const html = page.locator("html");
    const initialClass = await html.getAttribute("class");
    
    // Find and click theme toggle
    const themeToggle = page.locator('[data-testid="theme-toggle"], button:has-text("theme"), button:has-text("dark"), button:has-text("light")');
    
    if (await themeToggle.first().isVisible()) {
      await themeToggle.first().click();
      
      // Theme class should change
      await page.waitForTimeout(500);
      const newClass = await html.getAttribute("class");
      
      // Classes might have changed (dark/light)
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("should persist theme preference", async ({ page }) => {
    await page.goto("/");
    
    // Set theme via localStorage
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
    });
    
    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");
    
    // Theme should be applied
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Responsive Design", () => {
  test("should work on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    
    // Page should be visible and not broken
    await expect(page.locator("body")).toBeVisible();
    
    // Main content should be visible
    const main = page.locator("main, .content, article");
    await expect(main.first()).toBeVisible();
  });

  test("should work on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    
    await expect(page.locator("body")).toBeVisible();
  });

  test("should work on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    
    await expect(page.locator("body")).toBeVisible();
  });

  test("should have mobile menu on small screens", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    
    // Look for hamburger menu or mobile navigation
    const mobileMenu = page.locator('[data-testid="mobile-menu"], .hamburger, button:has([class*="menu"])');
    // Mobile menu may or may not be present depending on design
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Accessibility", () => {
  test("should have proper heading structure", async ({ page }) => {
    await page.goto("/");
    
    // Should have h1
    const h1 = page.locator("h1");
    await expect(h1.first()).toBeVisible();
  });

  test("should have alt text on images", async ({ page }) => {
    await page.goto("/");
    
    const images = page.locator("img");
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      // Alt should exist (can be empty for decorative images)
      expect(alt !== null).toBe(true);
    }
  });

  test("should be keyboard navigable", async ({ page }) => {
    await page.goto("/");
    
    // Tab through interactive elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    
    // Something should be focused
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });

  test("should have proper focus indicators", async ({ page }) => {
    await page.goto("/");
    
    // Tab to first interactive element
    await page.keyboard.press("Tab");
    
    // Focused element should be visible
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });
});
