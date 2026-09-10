import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig(({ command }) => {
	if (command === "build") {
		process.env.NODE_ENV = "production";
		process.env.VITE_USER_NODE_ENV = "";
	}

	return {
		resolve: { tsconfigPaths: true },
		plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
	};
});

export default config;
