import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/db/migrate.ts", "src/scripts/create-admin.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
});
