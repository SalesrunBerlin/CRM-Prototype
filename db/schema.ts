import { pgTable, text, integer, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roles = pgTable("roles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  permissions: jsonb("permissions").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  userId: integer("user_id").references(() => users.id).notNull(),
  roleId: integer("role_id").references(() => roles.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: primaryKey(table.userId, table.roleId),
}));

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const objects = pgTable("objects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  fields: jsonb("fields").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const objectRelations = pgTable("object_relations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sourceId: integer("source_id").references(() => objects.id),
  targetId: integer("target_id").references(() => objects.id),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const objectTypes = pgTable("object_types", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  fields: jsonb("fields").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema types
export const insertCompanySchema = createInsertSchema(companies);
export const selectCompanySchema = createSelectSchema(companies);
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = z.infer<typeof selectCompanySchema>;

// Create a custom insert user schema that includes companyName
const baseUserSchema = createInsertSchema(users);
export const insertUserSchema = baseUserSchema.extend({
  companyName: z.string().min(1).optional(),
});
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;

export const insertRoleSchema = createInsertSchema(roles);
export const selectRoleSchema = createSelectSchema(roles);
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = z.infer<typeof selectRoleSchema>;

export const insertUserRoleSchema = createInsertSchema(userRoles);
export const selectUserRoleSchema = createSelectSchema(userRoles);
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = z.infer<typeof selectUserRoleSchema>;

export const insertObjectSchema = createInsertSchema(objects);
export const selectObjectSchema = createSelectSchema(objects);
export type InsertObject = z.infer<typeof insertObjectSchema>;
export type Object = z.infer<typeof selectObjectSchema>;

export const insertObjectTypeSchema = createInsertSchema(objectTypes);
export const selectObjectTypeSchema = createSelectSchema(objectTypes);
export type InsertObjectType = z.infer<typeof insertObjectTypeSchema>;
export type ObjectType = z.infer<typeof selectObjectTypeSchema>;
