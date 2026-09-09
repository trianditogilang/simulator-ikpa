/** Runtime safeguards used by server functions that historically had demo fallbacks. */
export function failIfProduction(condition: boolean, message: string): void {
	if (condition && process.env.NODE_ENV === "production") {
		const error = new Error(message);
		error.name = "ProductionRuntimeError";
		throw error;
	}
}

export function assertProductionFileSignature(bytes: Uint8Array, signature: Uint8Array, label: string): void {
	if (process.env.NODE_ENV !== "production") return;
	const valid = signature.every((value, index) => bytes[index] === value);
	if (!valid) {
		const error = new Error(`${label} renderer returned an invalid file signature.`);
		error.name = "ProductionRuntimeError";
		throw error;
	}
}
