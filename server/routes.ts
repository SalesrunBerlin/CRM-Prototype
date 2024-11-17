import { type Express } from "express";
import { setupAuth, checkRole } from "./auth";
import { db } from "db";
import { objects, users, roles, userRoles } from "db/schema";
import { eq, and, ilike, or, desc, asc } from "drizzle-orm";

export function registerRoutes(app: Express) {
  setupAuth(app);

  // User management routes (admin only)
  app.get("/api/users", checkRole("admin"), async (req, res) => {
    try {
      const allUsers = await db
        .select()
        .from(users)
        .where(eq(users.companyId, req.user!.companyId!));

      const usersWithRoles = await Promise.all(
        allUsers.map(async (user) => {
          const userRolesList = await db
            .select({
              role: roles,
            })
            .from(userRoles)
            .innerJoin(roles, eq(roles.id, userRoles.roleId))
            .where(eq(userRoles.userId, user.id));

          return {
            ...user,
            roles: userRolesList.map((ur) => ur.role),
          };
        })
      );
      res.json(usersWithRoles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get all objects (scoped to company) with filtering and search
  app.get("/api/objects", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { search, type, sortBy, sortOrder, fields } = req.query;
      let query = db.select().from(objects)
        .where(eq(objects.companyId, req.user!.companyId!));

      // Apply search filter across multiple fields
      if (search) {
        query = query.where(
          or(
            ilike(objects.name, `%${search}%`),
            ilike(objects.type, `%${search}%`),
            ilike(objects.description, `%${search}%`)
          )
        );
      }

      // Apply type filter
      if (type && type !== '_all') {
        query = query.where(eq(objects.type, type as string));
      }

      // Apply field specific filters if provided
      if (fields) {
        const fieldFilters = JSON.parse(fields as string);
        Object.entries(fieldFilters).forEach(([key, value]) => {
          if (value) {
            query = query.where(`fields->>'${key}' ILIKE '%${value}%'`);
          }
        });
      }

      // Apply sorting
      if (sortBy) {
        const orderFunc = sortOrder === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'name':
            query = query.orderBy(orderFunc(objects.name));
            break;
          case 'type':
            query = query.orderBy(orderFunc(objects.type));
            break;
          case 'createdAt':
            query = query.orderBy(orderFunc(objects.createdAt));
            break;
          default:
            query = query.orderBy(desc(objects.createdAt));
        }
      } else {
        query = query.orderBy(desc(objects.createdAt));
      }

      const result = await query;
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch objects" });
    }
  });

  // Get distinct object types for filtering
  app.get("/api/object-types", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const types = await db
        .selectDistinct({ type: objects.type })
        .from(objects)
        .where(eq(objects.companyId, req.user!.companyId!));
      
      // Add default suggested types if no types exist
      const existingTypes = types.map(t => t.type);
      const suggestedTypes = ['Contact', 'Lead', 'Company', 'Project', 'Task'];
      const allTypes = [...new Set([...existingTypes, ...suggestedTypes])];
      
      res.json(allTypes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch object types" });
    }
  });

  // Create object (with company scope)
  app.post("/api/objects", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userRoles = req.user?.roles || [];
    if (!userRoles.some(r => r.permissions.create === true || r.permissions.all === true)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const [object] = await db
        .insert(objects)
        .values({
          ...req.body,
          createdBy: req.user!.id,
          companyId: req.user!.companyId!,
        })
        .returning();
      res.json(object);
    } catch (error) {
      res.status(500).json({ message: "Failed to create object" });
    }
  });

  // Update object (with company scope check)
  app.put("/api/objects/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userRoles = req.user?.roles || [];
    if (!userRoles.some(r => r.permissions.update === true || r.permissions.all === true)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const [object] = await db
        .select()
        .from(objects)
        .where(and(
          eq(objects.id, parseInt(req.params.id)),
          eq(objects.companyId, req.user!.companyId!)
        ))
        .limit(1);

      if (!object) {
        return res.status(404).json({ message: "Object not found" });
      }

      const [updatedObject] = await db
        .update(objects)
        .set(req.body)
        .where(eq(objects.id, parseInt(req.params.id)))
        .returning();
      res.json(updatedObject);
    } catch (error) {
      res.status(500).json({ message: "Failed to update object" });
    }
  });

  // Delete object (with company scope check)
  app.delete("/api/objects/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userRoles = req.user?.roles || [];
    if (!userRoles.some(r => r.permissions.delete === true || r.permissions.all === true)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const [object] = await db
        .select()
        .from(objects)
        .where(and(
          eq(objects.id, parseInt(req.params.id)),
          eq(objects.companyId, req.user!.companyId!)
        ))
        .limit(1);

      if (!object) {
        return res.status(404).json({ message: "Object not found" });
      }

      await db
        .delete(objects)
        .where(eq(objects.id, parseInt(req.params.id)));
      res.json({ message: "Object deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete object" });
    }
  });

  // Role management routes
  app.get("/api/roles", async (req, res) => {
    if (!req.user?.roles?.some(r => r.name === "admin")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const allRoles = await db.select().from(roles);
      res.json(allRoles);
    } catch (error) {
      res.status(500).json({ message: "Error fetching roles" });
    }
  });

  // Assign role to user (admin only, same company)
  app.post("/api/users/:userId/roles", checkRole("admin"), async (req, res) => {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;

      // Check if the target user is in the same company
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .limit(1);

      if (!targetUser || targetUser.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await db.insert(userRoles).values({
        userId: parseInt(userId),
        roleId: parseInt(roleId),
      });

      res.json({ message: "Role assigned successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error assigning role" });
    }
  });
}