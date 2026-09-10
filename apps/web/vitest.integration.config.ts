import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.integration.test.{ts,tsx}"],
		exclude: ["e2e/**", "node_modules/**", "dist/**"],
		fileParallelism: false,
		testTimeout: 30_000,
		hookTimeout: 30_000,
		globals: false,
	},
});
