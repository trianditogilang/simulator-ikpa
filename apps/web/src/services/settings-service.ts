import {
	getSatkerSettingsFn,
	registerSatkerOnboardingFn,
	type SatkerSettingsData,
	updateSatkerSettingsFn,
} from "@/server/settings";

export type { SatkerSettingsData };

export interface RegisterSatkerInput {
	kodeSatker: string;
	name: string;
	isBlu?: boolean;
}

export interface UpdateSatkerInput {
	orgId: string;
	name: string;
	isBlu: boolean;
}

export async function fetchSatkerSettings(
	orgId?: string,
): Promise<SatkerSettingsData> {
	return getSatkerSettingsFn({ data: orgId ? { orgId } : undefined });
}

export async function updateSatkerSettings(
	input: UpdateSatkerInput,
): Promise<{ success: boolean }> {
	return updateSatkerSettingsFn({ data: input });
}

export async function registerSatkerOnboarding(
	input: RegisterSatkerInput,
): Promise<{
	success: boolean;
	orgId: string;
	satkerName: string;
	kodeSatker: string;
}> {
	return registerSatkerOnboardingFn({ data: input });
}
