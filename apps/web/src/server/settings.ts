import { uuidSchema } from "@simulator-ikpa/contracts";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	handleGetSatkerSettings,
	handleRegisterSatkerOnboarding,
	handleUpdateSatkerSettings,
	type SatkerSettingsData,
} from "./domains/settings.server";

export type { SatkerSettingsData };

export const registerSatkerOnboardingSchema = z.strictObject({
	kodeSatker: z
		.string()
		.trim()
		.min(4, "Kode Satker minimal 4 karakter")
		.max(12, "Kode Satker maksimal 12 karakter")
		.regex(/^[A-Za-z0-9]+$/, "Kode Satker hanya boleh berupa huruf dan angka"),
	name: z
		.string()
		.trim()
		.min(3, "Nama Satker minimal 3 karakter")
		.max(200, "Nama Satker maksimal 200 karakter"),
	isBlu: z.boolean().optional().default(false),
});

export const updateSatkerSettingsSchema = z.strictObject({
	orgId: uuidSchema,
	name: z
		.string()
		.trim()
		.min(3, "Nama Satker minimal 3 karakter")
		.max(200, "Nama Satker maksimal 200 karakter"),
	isBlu: z.boolean(),
});

export const registerSatkerOnboardingFn = createServerFn({ method: "POST" })
	.validator((data: z.input<typeof registerSatkerOnboardingSchema>) =>
		registerSatkerOnboardingSchema.parse(data),
	)
	.handler(async ({ data }) => handleRegisterSatkerOnboarding(data));

export const getSatkerSettingsFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string }) => data)
	.handler(
		async ({ data }): Promise<SatkerSettingsData> =>
			handleGetSatkerSettings(data),
	);

export const updateSatkerSettingsFn = createServerFn({ method: "POST" })
	.validator((data: z.infer<typeof updateSatkerSettingsSchema>) =>
		updateSatkerSettingsSchema.parse(data),
	)
	.handler(async ({ data }) => handleUpdateSatkerSettings(data));
