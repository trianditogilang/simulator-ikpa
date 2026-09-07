export type NumericValue = number | string;
export type DateValue = Date | number | string;

const numberFormatter = new Intl.NumberFormat("id-ID", {
	maximumFractionDigits: 2,
	minimumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("id-ID", {
	currency: "IDR",
	maximumFractionDigits: 0,
	style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
	day: "2-digit",
	month: "short",
	timeZone: "Asia/Jakarta",
	year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
	hour: "2-digit",
	hour12: false,
	minute: "2-digit",
	timeZone: "Asia/Jakarta",
});

function toFiniteNumber(value: NumericValue): number {
	const number = typeof value === "number" ? value : Number(value);

	if (!Number.isFinite(number)) {
		throw new RangeError("Nilai numerik tidak valid");
	}

	return number;
}

function toValidDate(value: DateValue): Date {
	const date =
		value instanceof Date ? new Date(value.getTime()) : new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new RangeError("Tanggal tidak valid");
	}

	return date;
}

/** Formats a display value with two decimal places in Indonesian notation. */
export function formatNumber(value: NumericValue): string {
	return numberFormatter.format(toFiniteNumber(value));
}

/** Formats a simulator score/value; the input is already a display percentage point value. */
export function formatValue(value: NumericValue): string {
	return formatNumber(value);
}

export function formatScore(value: NumericValue): string {
	return formatNumber(value);
}

export function formatRupiah(value: NumericValue): string {
	return currencyFormatter.format(toFiniteNumber(value)).replace(/\u00a0/g, "");
}

/** Formats a percentage input such as 88.4 as 88,40%, not as a 0–1 ratio. */
export function formatPercent(value: NumericValue): string {
	return `${formatNumber(value)}%`;
}

/** Formats a number with up to maxFractionDigits, but omits decimal zeros if whole number. */
export function formatDynamicNumber(
	value: NumericValue,
	maxFractionDigits = 2,
): string {
	const num = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(num)) return "0";
	return num.toLocaleString("id-ID", {
		minimumFractionDigits: 0,
		maximumFractionDigits: maxFractionDigits,
	});
}

/** Formats percentage omitting decimal zeros if whole (e.g. 100% or 25% or 80,5%). */
export function formatDynamicPercent(
	value: NumericValue,
	maxFractionDigits = 2,
): string {
	return `${formatDynamicNumber(value, maxFractionDigits)}%`;
}

export function formatPermille(value: NumericValue): string {
	return `${formatNumber(value)}‰`;
}

export function formatDate(value: DateValue): string {
	return dateFormatter.format(toValidDate(value));
}

/** Formats a date value as DD-MM-YYYY (e.g. 07-10-2026). */
export function formatDateDDMMYYYY(value?: DateValue | null): string {
	if (!value) return "—";
	if (typeof value === "string") {
		const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (match) {
			const [, y, m, d] = match;
			return `${d}-${m}-${y}`;
		}
	}
	try {
		const d = toValidDate(value);
		const day = String(d.getDate()).padStart(2, "0");
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const year = d.getFullYear();
		return `${day}-${month}-${year}`;
	} catch {
		return String(value);
	}
}

export function formatTimeWIB(value: DateValue): string {
	return `${timeFormatter.format(toValidDate(value))} WIB`;
}

export function formatPointDelta(value: NumericValue): string {
	const number = toFiniteNumber(value);
	const sign = number > 0 ? "+" : number < 0 ? "−" : "";

	return `${sign}${formatNumber(Math.abs(number))} poin`;
}
