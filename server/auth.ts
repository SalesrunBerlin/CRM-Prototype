import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express, type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, roles, userRoles, companies, type User as SelectUser } from "db/schema";
import { db } from "db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

declare global {
  namespace Express {
    interface User extends SelectUser {
      roles?: any[];
      companyId?: number;
    }
  }
}

async function getUserRoles(userId: number) {
  const userRolesList = await db
    .select({
      role: roles,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));
  
  return userRolesList.map(ur => ur.role);
}

async function ensureRoleExists(name: string, permissions: any) {
  const [existingRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, name))
    .limit(1);

  if (!existingRole) {
    const [newRole] = await db
      .insert(roles)
      .values({ name, permissions })
      .returning();
    return newRole;
  }

  return existingRole;
}

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: app.get("env") === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // Prune expired entries every 24h
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid username or password" });
        }

        const userRolesList = await getUserRoles(user.id);
        return done(null, { ...user, roles: userRolesList });
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      
      if (user) {
        const userRolesList = await getUserRoles(user.id);
        Object.assign(user, { roles: userRolesList });
      }
      
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, companyName } = req.body;

      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Create company
      const [company] = await db
        .insert(companies)
        .values({ name: companyName })
        .returning();

      // Ensure admin role exists
      const adminRole = await ensureRoleExists("admin", {
        all: true,
        create: true,
        read: true,
        update: true,
        delete: true,
        manageUsers: true,
      });

      // Ensure user role exists
      const userRole = await ensureRoleExists("user", {
        create: true,
        read: true,
        update: true,
        delete: true,
      });

      // Hash password and create user
      const hashedPassword = await crypto.hash(password);
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          companyId: company.id,
        })
        .returning();

      // Check if this is the first user in the company
      const companyUsers = await db
        .select()
        .from(users)
        .where(eq(users.companyId, company.id));

      // Assign appropriate role
      const roleToAssign = companyUsers.length === 1 ? adminRole : userRole;
      await db.insert(userRoles).values({
        userId: newUser.id,
        roleId: roleToAssign.id,
      });

      // Log in the new user
      const userRolesList = await getUserRoles(newUser.id);
      const userWithRoles = { ...newUser, roles: userRolesList };
      
      req.login(userWithRoles, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error logging in" });
        }
        const { password: _, ...user } = userWithRoles;
        return res.json({
          message: "Registration successful",
          user,
        });
      });
    } catch (error) {
      res.status(500).json({ message: "Error creating user" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: Express.User, info: IVerifyOptions) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        const { password: _, ...userData } = user;
        return res.json({
          message: "Login successful",
          user: userData,
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging out" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password: _, ...user } = req.user;
    res.json(user);
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

  app.post("/api/users/:userId/roles", async (req, res) => {
    if (!req.user?.roles?.some(r => r.name === "admin")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const { userId } = req.params;
      const { roleId } = req.body;

      // Check if the target user is in the same company
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .limit(1);

      if (!targetUser || targetUser.companyId !== req.user.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await db.insert(userRoles).values({
        userId: parseInt(userId),
        roleId: roleId,
      });

      res.json({ message: "Role assigned successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error assigning role" });
    }
  });

  // User management routes
  app.get("/api/users", async (req, res) => {
    if (!req.user?.roles?.some(r => r.name === "admin")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      // Only fetch users from the same company
      const companyUsers = await db
        .select()
        .from(users)
        .where(eq(users.companyId, req.user.companyId!));

      const usersWithRoles = await Promise.all(
        companyUsers.map(async (user) => {
          const userRolesList = await getUserRoles(user.id);
          return {
            ...user,
            roles: userRolesList,
          };
        })
      );

      res.json(usersWithRoles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Auth middleware with role check
  app.use("/api/*", (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  });
}

export function checkRole(roleName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.roles?.some(r => r.name === roleName)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
