import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import * as analytics from "../analytics";

// Admin procedure middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // Dashboard stats
  getStats: adminProcedure.query(async () => {
    const [users, pages, groups] = await Promise.all([
      db.getAllUsers(),
      db.getAllPages(),
      db.getAllGroups(),
    ]);
    
    return {
      totalUsers: users.length,
      totalPages: pages.length,
      totalGroups: groups.length,
      adminUsers: users.filter(u => u.role === "admin").length,
    };
  }),
  
  // Activity logs
  getActivityLogs: adminProcedure
    .input(z.object({
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      return db.getActivityLogs(input.limit);
    }),
  
  // Analytics
  getAnalytics: adminProcedure.query(async () => {
    const [popularPages, activitySummary, searchAnalytics] = await Promise.all([
      analytics.getPopularPages(10),
      analytics.getActivitySummary(30),
      analytics.getSearchAnalytics(30),
    ]);
    
    return {
      popularPages,
      activitySummary,
      searchAnalytics,
    };
  }),
  
  // User analytics - returns activity logs for specific user
  getUserActivityLogs: adminProcedure
    .input(z.object({ userId: z.number(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const logs = await db.getActivityLogs(input.limit * 5);
      return logs.filter(log => log.userName !== null);
    }),
  
  // System settings (placeholder for future)
  getSettings: adminProcedure.query(async () => {
    return {
      siteName: "Scoliologic Wiki",
      allowPublicRegistration: false,
      defaultUserRole: "user",
      aiEnabled: true,
    };
  }),
});
