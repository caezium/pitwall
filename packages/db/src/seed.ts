import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { categories } from "./schema/expenses";
import path from "path";

const dbPath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "pitwall.db");
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

const defaultCategories = [
  // Karting
  { name: "Entry Fees", domain: "karting" as const, icon: "flag", color: "#ef4444" },
  { name: "Tires", domain: "karting" as const, icon: "circle", color: "#f97316" },
  { name: "Fuel", domain: "karting" as const, icon: "fuel", color: "#eab308" },
  { name: "Parts & Maintenance", domain: "karting" as const, icon: "wrench", color: "#a855f7" },
  { name: "Travel", domain: "karting" as const, icon: "car", color: "#3b82f6" },
  { name: "Gear", domain: "karting" as const, icon: "shield", color: "#6366f1" },
  // AI
  { name: "OpenAI", domain: "ai" as const, icon: "brain", color: "#10b981" },
  { name: "Anthropic", domain: "ai" as const, icon: "cpu", color: "#f59e0b" },
  { name: "Google AI", domain: "ai" as const, icon: "search", color: "#3b82f6" },
  { name: "Other AI", domain: "ai" as const, icon: "zap", color: "#8b5cf6" },
  // General
  { name: "Uncategorized", domain: "general" as const, icon: "box", color: "#71717a" },
];

console.log("Seeding default categories...");
for (const cat of defaultCategories) {
  db.insert(categories).values(cat).onConflictDoNothing().run();
}
console.log(`Seeded ${defaultCategories.length} categories.`);
sqlite.close();
