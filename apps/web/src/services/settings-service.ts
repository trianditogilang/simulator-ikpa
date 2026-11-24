import {
	getMyAccessRequestFn,
	getSatkerSettingsFn,
	type MyAccessRequest,
	requestSatkerAccessFn,
	type SatkerSettingsData,
	updateSatkerSettingsFn,
} from "@/server/settings";

export type { MyAccessRequest, SatkerSettingsData };

export interface RequestSatkerAccessInput {
	kodeSatker: string;
	name: string;
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

export async function requestSatkerAccess(
	input: RequestSatkerAccessInput,
): Promise<{ success: true }> {
	return requestSatkerAccessFn({ data: input });
}

export async function fetchMyAccessRequest(): Promise<MyAccessRequest> {
	return getMyAccessRequestFn();
}
