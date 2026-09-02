import { requestOperatorXlsxFn } from "@/server/exports/operator-xlsx";
import { requestOperatorPdfFn } from "@/server/exports/operator-pdf";
import { requestAdminAggregatePdfFn, requestAdminAggregateXlsxFn } from "@/server/exports/admin-aggregate";

function base64ToBytes(b64: string): Uint8Array {
	if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(b64, "base64"));
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

export async function fetchOperatorXlsx(orgId?: string) {
	return requestOperatorXlsxFn({ data: orgId ? { orgId } : undefined });
}
export async function fetchOperatorPdf(orgId?: string, periodMonth?: number) {
	return requestOperatorPdfFn({ data: { orgId, periodMonth } });
}
export async function fetchAdminAggregateXlsx(kppnScopeId: string, year?: number, month?: number) {
	return requestAdminAggregateXlsxFn({ data: { kppnScopeId, year, month } });
}
export async function fetchAdminAggregatePdf(kppnScopeId: string, year?: number, month?: number) {
	return requestAdminAggregatePdfFn({ data: { kppnScopeId, year, month } });
}

export function triggerDownload(contentBase64: string, filename: string, mimeType: string) {
	const bytes = base64ToBytes(contentBase64);
	const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
