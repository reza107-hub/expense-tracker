import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Pulled from Vercel with: vercel env pull .env.local
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations use the direct (unpooled) connection when Vercel provides one.
    url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!,
  },
});
