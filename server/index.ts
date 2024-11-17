import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { createServer } from "http";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register routes before Vite middleware
registerRoutes(app);

const server = createServer(app);

// Setup Vite or serve static files
if (app.get("env") === "development") {
  await setupVite(app, server);
} else {
  serveStatic(app);
}

const PORT = 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});