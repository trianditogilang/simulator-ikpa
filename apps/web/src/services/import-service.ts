import {
	cancelImportFn,
	commitImportFn,
	getImportJobFn,
	listImportJobsFn,
	uploadImportFn,
} from "@/server/import";

export type ImportJobSummary = {
	id: string;
	domain: string;
	filename: string;
	status: string;
	totalRows: number;
	validRows: number;
	invalidRows: number;
	createdAt: string;
	errorReportJson?: unknown;
};

function arrayBufferToBase64(buf: ArrayBuffer): string {
	if (typeof Buffer !== "undefined") return Buffer.from(buf).toString("base64");
	const bytes = new Uint8Array(buf);
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary);
}
function base64ToBytes(b64: string): Uint8Array {
	if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(b64, "base64"));
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

export async function uploadImportFile(args: {
	orgId?: string;
	domain: string;
	file: File;
}): Promise<{ jobId: string; domain: string; filename: string; totalRows: number; validRows: number; invalidRows: number; errors: Array<{ row: number; column?: string; message: string }>; preview: unknown[]; status: string }> {
	const buf = await args.file.arrayBuffer();
	const base64 = arrayBufferToBase64(buf);
	return uploadImportFn({ data: { orgId: args.orgId, domain: args.domain, filename: args.file.name, contentBase64: base64, mimeType: args.file.type } }) as unknown as Promise<{ jobId: string; domain: string; filename: string; totalRows: number; validRows: number; invalidRows: number; errors: Array<{ row: number; column?: string; message: string }>; preview: unknown[]; status: string }>;
}

export async function fetchImportJobs(orgId?: string): Promise<{ jobs: ImportJobSummary[] }> {
	return listImportJobsFn({ data: orgId ? { orgId } : undefined }) as Promise<{ jobs: ImportJobSummary[] }>;
}

export async function fetchImportJob(jobId: string, orgId?: string) {
	return getImportJobFn({ data: { jobId, orgId } });
}

export async function commitImportJob(jobId: string, orgId?: string) {
	return commitImportFn({ data: { jobId, orgId } });
}

export async function cancelImportJob(jobId: string, orgId?: string) {
	return cancelImportFn({ data: { jobId, orgId } });
}

// helper for authenticated download (no permanent public URL)
export function downloadBase64File(contentBase64: string, filename: string, mimeType: string) {
	const bytes = base64ToBytes(contentBase64);
	const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
