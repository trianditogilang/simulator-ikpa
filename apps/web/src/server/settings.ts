import { uuidSchema } from "@simulator-ikpa/contracts";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { KODE_SATKER_PATTERN, KODE_SATKER_RULE } from "./auth-session";
import {
	handleGetMyAccessRequest,
	handleGetSatkerSettings,
	handleRequestSatkerAccess,
	handleUpdateSatkerSettings,
	type MyAccessRequest,
	type SatkerSettingsData,
} from "./domains/settings.server";

export type { MyAccessRequest, SatkerSettingsData };

export const requestSatkerAccessSchema = z.strictObject({
	kodeSatker: z
		.string()
		.trim()
		.regex(KODE_SATKER_PATTERN, KODE_SATKER_RULE),
	name: z
		.string()
		.trim()
		.min(3, "Nama Satker minimal 3 karakter")
		.max(200, "Nama Satker maksimal 200 karakter"),
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

/** Self-service sign-up files a request; an Admin KPPN grants the access. */
export const requestSatkerAccessFn = createServerFn({ method: "POST" })
	.validator((data: z.input<typeof requestSatkerAccessSchema>) =>
		requestSatkerAccessSchema.parse(data),
	)
	.handler(async ({ data }) => handleRequestSatkerAccess(data));

export const getMyAccessRequestFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<MyAccessRequest> => handleGetMyAccessRequest(),
);

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
