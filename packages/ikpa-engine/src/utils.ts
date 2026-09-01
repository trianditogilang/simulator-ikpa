export function parseDecimal(val: string | number): number {
	return typeof val === "string" ? parseFloat(val) : val;
}

export function toFixedPoint(val: string | number, scale = 100000000): number {
	return Math.round(parseDecimal(val) * scale);
}

export function fromFixedPoint(val: number, scale = 100000000): number {
	return val / scale;
}

export function add(a: string | number, b: string | number): string {
	const result = (toFixedPoint(a) + toFixedPoint(b)) / 100000000;
	return result.toString();
}

export function sub(a: string | number, b: string | number): string {
	const result = (toFixedPoint(a) - toFixedPoint(b)) / 100000000;
	return result.toString();
}

export function mul(a: string | number, b: string | number): string {
	const valA = parseDecimal(a);
	const valB = parseDecimal(b);
	return (valA * valB).toString();
}

export function div(a: string | number, b: string | number): string {
	const valA = parseDecimal(a);
	const valB = parseDecimal(b);
	if (valB === 0) return "0";
	return (valA / valB).toString();
}

export function round(val: string | number, fractionDigits = 2): string {
	const num = parseDecimal(val);
	const multiplier = 10 ** fractionDigits;
	return (Math.round(num * multiplier) / multiplier).toFixed(fractionDigits);
}
