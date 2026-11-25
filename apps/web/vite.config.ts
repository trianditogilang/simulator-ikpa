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
		plugins: [
			devtools(),
			tailwindcss(),
			tanstackStart(),
			// ADR-008: pin the preset so no host (e.g. Vercel) is auto-detected.
			nitro({ preset: "node-server" }),
			viteReact(),
		],
	};
});

export default config;
