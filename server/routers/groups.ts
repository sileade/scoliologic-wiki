import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

// Admin procedure middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const groupsRouter = router({
  list: protectedProcedure.query(async () => {
    return db.getAllGroups();
  }),
  
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getGroupById(input.id);
    }),
  
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createGroup({
        name: input.name,
        description: input.description,
        color: input.color,
        createdById: ctx.user.id,
      });
      await db.logActivity({
        userId: ctx.user.id,
        action: "create_group",
        entityType: "group",
        entityId: id,
        details: { name: input.name },
      });
      return { id };
    }),
  
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateGroup(id, data);
      await db.logActivity({
        userId: ctx.user.id,
        action: "update_group",
        entityType: "group",
        entityId: id,
        details: data,
      });
      return { success: true };
    }),
  
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteGroup(input.id);
      await db.logActivity({
        userId: ctx.user.id,
        action: "delete_group",
        entityType: "group",
        entityId: input.id,
      });
      return { success: true };
    }),
  
  getMembers: protectedProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input }) => {
      return db.getGroupMembers(input.groupId);
    }),
  
  addMember: adminProcedure
    .input(z.object({
      groupId: z.number(),
      userId: z.number(),
      role: z.enum(["member", "editor", "admin"]).default("member"),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.addUserToGroup({
        groupId: input.groupId,
        userId: input.userId,
        role: input.role,
      });
      await db.logActivity({
        userId: ctx.user.id,
        action: "add_group_member",
        entityType: "group",
        entityId: input.groupId,
        details: { memberId: input.userId, role: input.role },
      });
      return { success: true };
    }),
  
  removeMember: adminProcedure
    .input(z.object({
      groupId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.removeUserFromGroup(input.userId, input.groupId);
      await db.logActivity({
        userId: ctx.user.id,
        action: "remove_group_member",
        entityType: "group",
        entityId: input.groupId,
        details: { memberId: input.userId },
      });
      return { success: true };
    }),
  
  updateMemberRole: adminProcedure
    .input(z.object({
      groupId: z.number(),
      userId: z.number(),
      role: z.enum(["member", "editor", "admin"]),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.addUserToGroup({
        groupId: input.groupId,
        userId: input.userId,
        role: input.role,
      });
      await db.logActivity({
        userId: ctx.user.id,
        action: "update_member_role",
        entityType: "group",
        entityId: input.groupId,
        details: { memberId: input.userId, newRole: input.role },
      });
      return { success: true };
    }),
});
