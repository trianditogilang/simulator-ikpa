import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.{ts,tsx}"],
		exclude: [
			"e2e/**",
			"src/**/*.integration.test.{ts,tsx}",
			"node_modules/**",
			"dist/**",
		],
		globals: false,
	},
});
