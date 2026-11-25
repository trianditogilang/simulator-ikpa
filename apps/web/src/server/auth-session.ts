export interface AuthSession {
	/** `users.id` of the verified session user (ADR-008: canonical identity). */
	userId: string | null;
	email: string | null;
	name: string | null;
	isAuthenticated: boolean;
}

export function createUnauthenticatedAuthSession(): AuthSession {
	return {
		userId: null,
		email: null,
		name: null,
		isAuthenticated: false,
	};
}

/** Shared by the sign-up form and the Better Auth server config. */
export const MIN_PASSWORD_LENGTH = 10;

export const PASSWORD_RULE_HINT = `Minimal ${MIN_PASSWORD_LENGTH} karakter, berisi huruf dan angka.`;

/** New passwords (sign-up, reset) need at least one letter and one digit. */
export function hasLetterAndDigit(password: string): boolean {
	return /[A-Za-z]/.test(password) && /\d/.test(password);
}

/** "admin@kemenkeu.go.id" → "ad****@kemenkeu.go.id"; shown on public pages. */
export function maskEmailHint(email: string): string {
	const [localPart = "", domain = ""] = email.trim().split("@");
	return `${localPart.slice(0, localPart.length > 2 ? 2 : 1)}****@${domain}`;
}

/**
 * Owner decision 2026-11-24: an official kode satker is exactly 6 digits, so
 * a code that lost its leading zero (Excel: 012345 → 12345) is refused instead
 * of becoming a second satker.
 */
export const KODE_SATKER_PATTERN = /^\d{6}$/;
export const KODE_SATKER_RULE = "Kode Satker harus tepat 6 digit angka (contoh: 411782).";
