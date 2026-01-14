import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getAllUsers: vi.fn().mockResolvedValue([
    { id: 1, name: "Admin User", email: "admin@test.com", role: "admin", lastSignedIn: new Date() },
    { id: 2, name: "Regular User", email: "user@test.com", role: "user", lastSignedIn: new Date() },
  ]),
  getAllGroups: vi.fn().mockResolvedValue([
    { id: 1, name: "Engineering", description: "Engineering team", color: "#3B82F6" },
  ]),
  getAllPages: vi.fn().mockResolvedValue([
    { id: 1, title: "Welcome", slug: "welcome", isPublic: true, content: "Welcome content" },
    { id: 2, title: "Private", slug: "private", isPublic: false, content: "Private content" },
  ]),
  getPublicPages: vi.fn().mockResolvedValue([
    { id: 1, title: "Welcome", slug: "welcome", isPublic: true, content: "Welcome content" },
  ]),
  getRootPages: vi.fn().mockResolvedValue([
    { id: 1, title: "Welcome", slug: "welcome", isPublic: true, parentId: null },
    { id: 2, title: "Private", slug: "private", isPublic: false, parentId: null },
  ]),
  getPageBySlug: vi.fn().mockImplementation((slug: string) => {
    if (slug === "welcome") {
      return { id: 1, title: "Welcome", slug: "welcome", isPublic: true, content: "Welcome content" };
    }
    if (slug === "private") {
      return { id: 2, title: "Private", slug: "private", isPublic: false, content: "Private content" };
    }
    return null;
  }),
  getPageById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return { id: 1, title: "Welcome", slug: "welcome", isPublic: true, content: "Welcome content" };
    }
    if (id === 2) {
      return { id: 2, title: "Private", slug: "private", isPublic: false, content: "Private content" };
    }
    return null;
  }),
  checkUserPagePermission: vi.fn().mockResolvedValue(null),
  createPage: vi.fn().mockResolvedValue(3),
  updatePage: vi.fn().mockResolvedValue(undefined),
  deletePage: vi.fn().mockResolvedValue(undefined),
  createPageVersion: vi.fn().mockResolvedValue(1),
  logActivity: vi.fn().mockResolvedValue(undefined),
  getActivityLogs: vi.fn().mockResolvedValue([]),
  getPendingAccessRequests: vi.fn().mockResolvedValue([]),
  searchPages: vi.fn().mockResolvedValue([]),
  getAllEmbeddings: vi.fn().mockResolvedValue([]),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: role === "admin" ? 1 : 2,
    openId: `${role}-openid`,
    email: `${role}@test.com`,
    name: `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Wiki Pages API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("pages.getRootPages", () => {
    it("returns only public pages for guests", async () => {
      const ctx = createGuestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.pages.getRootPages();

      expect(result).toHaveLength(1);
      expect(result[0].isPublic).toBe(true);
    });

    it("returns all pages for admin users", async () => {
      const ctx = createUserContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.pages.getRootPages();

      expect(result).toHaveLength(2);
    });
  });

  describe("pages.getBySlug", () => {
    it("allows guests to access public pages", async () => {
      const ctx = createGuestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.pages.getBySlug({ slug: "welcome" });

      expect(result.title).toBe("Welcome");
      expect(result.isPublic).toBe(true);
    });

    it("denies guests access to private pages", async () => {
      const ctx = createGuestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.pages.getBySlug({ slug: "private" })).rejects.toThrow("Access denied");
    });

    it("throws NOT_FOUND for non-existent pages", async () => {
      const ctx = createGuestContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.pages.getBySlug({ slug: "nonexistent" })).rejects.toThrow("Page not found");
    });
  });
});

describe("User Management API", () => {
  describe("users.list", () => {
    it("allows admin to list all users", async () => {
      const ctx = createUserContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.users.list();

      expect(result).toHaveLength(2);
    });

    it("denies regular users from listing users", async () => {
      const ctx = createUserContext("user");
      const caller = appRouter.createCaller(ctx);

      await expect(caller.users.list()).rejects.toThrow("Admin access required");
    });
  });
});

describe("Group Management API", () => {
  describe("groups.list", () => {
    it("allows authenticated users to list groups", async () => {
      const ctx = createUserContext("user");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.groups.list();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Engineering");
    });
  });
});

describe("Admin API", () => {
  describe("admin.getDashboardStats", () => {
    it("returns dashboard statistics for admin", async () => {
      const ctx = createUserContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.getDashboardStats();

      expect(result).toHaveProperty("totalUsers");
      expect(result).toHaveProperty("totalPages");
      expect(result).toHaveProperty("totalGroups");
      expect(result).toHaveProperty("recentActivity");
    });

    it("denies regular users access to dashboard stats", async () => {
      const ctx = createUserContext("user");
      const caller = appRouter.createCaller(ctx);

      await expect(caller.admin.getDashboardStats()).rejects.toThrow("Admin access required");
    });
  });

  describe("admin.getPendingAccessRequests", () => {
    it("returns pending requests for admin", async () => {
      const ctx = createUserContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.getPendingAccessRequests();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("Authentication", () => {
  describe("auth.me", () => {
    it("returns null for unauthenticated users", async () => {
      const ctx = createGuestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeNull();
    });

    it("returns user data for authenticated users", async () => {
      const ctx = createUserContext("user");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).not.toBeNull();
      expect(result?.email).toBe("user@test.com");
    });
  });

  describe("auth.logout", () => {
    it("clears session cookie on logout", async () => {
      const ctx = createUserContext("user");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      expect(ctx.res.clearCookie).toHaveBeenCalled();
    });
  });
});
