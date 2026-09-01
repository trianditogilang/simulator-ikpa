export const DECIMALS = 6;
const MULTIPLIER = 1000000n; // 10^6

export function toBigInt(value: string | number): bigint {
	const str = typeof value === "number" ? value.toString() : value;
	const isNegative = str.startsWith("-");
	const cleanStr = isNegative ? str.slice(1) : str;
	const [intPart = "0", fracPart = ""] = cleanStr.split(".");
	const paddedFrac = fracPart.padEnd(DECIMALS, "0").slice(0, DECIMALS);
	const result = BigInt(intPart + paddedFrac);
	return isNegative ? -result : result;
}

export function formatBigInt(value: bigint): string {
	const isNegative = value < 0n;
	const absValue = isNegative ? -value : value;
	const str = absValue.toString().padStart(DECIMALS + 1, "0");
	const intPart = str.slice(0, -DECIMALS);
	let fracPart = str.slice(-DECIMALS);

	fracPart = fracPart.replace(/0+$/, "");
	const res = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
	return isNegative ? `-${res}` : res;
}

export const DecimalCalc = {
	add(a: string | number, b: string | number): string {
		return formatBigInt(toBigInt(a) + toBigInt(b));
	},
	sub(a: string | number, b: string | number): string {
		return formatBigInt(toBigInt(a) - toBigInt(b));
	},
	mul(a: string | number, b: string | number): string {
		const res = (toBigInt(a) * toBigInt(b)) / MULTIPLIER;
		return formatBigInt(res);
	},
	div(a: string | number, b: string | number): string {
		const divisor = toBigInt(b);
		if (divisor === 0n) throw new Error("Division by zero");
		const res = (toBigInt(a) * MULTIPLIER) / divisor;
		return formatBigInt(res);
	},
	roundHalfUp(a: string | number, decimals: number = 2): string {
		const val = toBigInt(a);
		const isNeg = val < 0n;
		const absVal = isNeg ? -val : val;

		const shift = BigInt(10 ** (DECIMALS - decimals));
		const half = shift / 2n;

		const roundedAbs = ((absVal + half) / shift) * shift;
		const finalVal = isNeg ? -roundedAbs : roundedAbs;

		const str = finalVal.toString().padStart(DECIMALS + 1, "0");
		const intPart = str.slice(0, -DECIMALS);
		const fracPart = str.slice(-DECIMALS, -DECIMALS + decimals);

		return decimals > 0
			? `${isNeg ? "-" : ""}${intPart}.${fracPart}`
			: `${isNeg ? "-" : ""}${intPart}`;
	},
	gt(a: string | number, b: string | number): boolean {
		return toBigInt(a) > toBigInt(b);
	},
	gte(a: string | number, b: string | number): boolean {
		return toBigInt(a) >= toBigInt(b);
	},
	lt(a: string | number, b: string | number): boolean {
		return toBigInt(a) < toBigInt(b);
	},
	lte(a: string | number, b: string | number): boolean {
		return toBigInt(a) <= toBigInt(b);
	},
	eq(a: string | number, b: string | number): boolean {
		return toBigInt(a) === toBigInt(b);
	},
};
