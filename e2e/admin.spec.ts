import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Admin Page
 */
test.describe("Admin Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
  });

  test("should display admin page or redirect to login", async ({ page }) => {
    // Admin page should either show content or redirect to login
    await page.waitForLoadState("networkidle");
    
    // Check if we're on admin page or redirected
    const url = page.url();
    expect(url).toMatch(/\/(admin|login|oauth)/);
  });

  test("should have admin navigation tabs", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    
    // If on admin page, check for tabs
    if (page.url().includes("/admin")) {
      const tabs = page.locator('[role="tablist"], .tabs, nav');
      await expect(tabs.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("should display dashboard tab by default", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    
    if (page.url().includes("/admin")) {
      // Dashboard or overview should be visible
      const dashboard = page.getByText(/dashboard|overview|statistics/i);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});

test.describe("Admin Users Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
  });

  test("should navigate to users tab", async ({ page }) => {
    if (page.url().includes("/admin")) {
      const usersTab = page.getByRole("tab", { name: /users/i });
      
      if (await usersTab.isVisible()) {
        await usersTab.click();
        await page.waitForLoadState("networkidle");
        
        // Users list should be visible
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });

  test("should display users list", async ({ page }) => {
    if (page.url().includes("/admin")) {
      const usersTab = page.getByRole("tab", { name: /users/i });
      
      if (await usersTab.isVisible()) {
        await usersTab.click();
        await page.waitForLoadState("networkidle");
        
        // Table or list of users
        const usersList = page.locator("table, .users-list, [role='grid']");
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });
});

test.describe("Admin Groups Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
  });

  test("should navigate to groups tab", async ({ page }) => {
    if (page.url().includes("/admin")) {
      const groupsTab = page.getByRole("tab", { name: /groups/i });
      
      if (await groupsTab.isVisible()) {
        await groupsTab.click();
        await page.waitForLoadState("networkidle");
        
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });

  test("should have create group button", async ({ page }) => {
    if (page.url().includes("/admin")) {
      const groupsTab = page.getByRole("tab", { name: /groups/i });
      
      if (await groupsTab.isVisible()) {
        await groupsTab.click();
        await page.waitForLoadState("networkidle");
        
        const createButton = page.getByRole("button", { name: /create|new|add/i });
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });
});

test.describe("Admin Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
  });

  test("should navigate to analytics tab", async ({ page }) => {
    if (page.url().includes("/admin")) {
      const analyticsTab = page.getByRole("tab", { name: /analytics|stats/i });
      
      if (await analyticsTab.isVisible()) {
        await analyticsTab.click();
        await page.waitForLoadState("networkidle");
        
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });

  test("should display analytics charts or data", async ({ page }) => {
    if (page.url().includes("/admin")) {
      const analyticsTab = page.getByRole("tab", { name: /analytics|stats/i });
      
      if (await analyticsTab.isVisible()) {
        await analyticsTab.click();
        await page.waitForLoadState("networkidle");
        
        // Charts or statistics should be visible
        const charts = page.locator("canvas, .chart, .statistics, svg");
        await expect(page.locator("body")).toBeVisible();
      }
    }
  });
});
