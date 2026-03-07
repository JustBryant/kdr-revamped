import "dotenv/config";
import { defineConfig } from "@prisma/config";

const datasource: any = {
  url: process.env.DATABASE_URL,
};

if (process.env.SHADOW_DATABASE_URL) {
  datasource.shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource,
});
