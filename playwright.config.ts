import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
	testDir: "./apps/web/e2e",
	outputDir: "./test-results/e2e",
	fullyParallel: true,
	forbidOnly: isCi,
	retries: isCi ? 2 : 0,
	workers: isCi ? 1 : undefined,
	reporter: isCi ? "line" : "list",
	use: {
		baseURL: "http://127.0.0.1:3000",
		screenshot: "only-on-failure",
		trace: "on-first-retry",
		video: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				...(isCi ? {} : { channel: "chrome" as const }),
			},
		},
		{
			name: "mobile-chrome",
			use: {
				...devices["Pixel 5"],
				...(isCi ? {} : { channel: "chrome" as const }),
			},
		},
	],
	webServer: {
		command:
			"npm run dev --workspace @simulator-ikpa/web -- --host 127.0.0.1 --port 3000",
		url: "http://127.0.0.1:3000",
		reuseExistingServer: !isCi,
		timeout: 120_000,
	},
});
