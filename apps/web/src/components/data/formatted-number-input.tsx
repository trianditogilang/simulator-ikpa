import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ChangeEvent,
	type InputHTMLAttributes,
} from "react";

const DIGIT_PATTERN = /[0-9]/g;
const SINGLE_DIGIT = /[0-9]/;

function stripLeadingZeros(digits: string): string {
	return digits.replace(/^0+(?=\d)/, "");
}

export function groupThousands(intDigits: string): string {
	const digits = stripLeadingZeros(intDigits.replace(/\D/g, ""));
	if (digits === "") return "";
	return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseGroupedInput(
	displayValue: string,
	allowDecimal: boolean,
	maxDecimals?: number,
	max?: number,
): string {
	const cleaned = displayValue.replace(/[^0-9,.-]/g, "");
	if (cleaned === "") return "";
	const negative = cleaned.startsWith("-");
	const unsigned = negative ? cleaned.slice(1) : cleaned;
	if (!allowDecimal) {
		const beforeComma = unsigned.includes(",")
			? unsigned.slice(0, unsigned.indexOf(","))
			: unsigned;
		let digits = stripLeadingZeros(beforeComma.replace(/\D/g, ""));
		if (digits === "") return "";
		if (max !== undefined && Number(digits) > max) {
			digits = String(max);
		}
		return `${negative ? "-" : ""}${digits}`;
	}

	// In Indonesian notation, comma (,) is the primary decimal separator.
	const commaIndex = unsigned.lastIndexOf(",");
	let intRaw = unsigned;
	let fracRaw = "";
	let hasDecimal = false;

	if (commaIndex >= 0) {
		intRaw = unsigned.slice(0, commaIndex);
		fracRaw = unsigned.slice(commaIndex + 1);
		hasDecimal = true;
	} else {
		// If there is no comma:
		// Dots are thousands separators except when user typed trailing dot or single dot decimal like 0.5
		const dotIndex = unsigned.lastIndexOf(".");
		if (dotIndex >= 0) {
			const dotCount = (unsigned.match(/\./g) || []).length;
			const isTrailingDot = dotIndex === unsigned.length - 1;
			if (isTrailingDot || (dotCount === 1 && unsigned.startsWith("0."))) {
				intRaw = unsigned.slice(0, dotIndex);
				fracRaw = unsigned.slice(dotIndex + 1);
				hasDecimal = true;
			}
		}
	}

	let intDigits = stripLeadingZeros(intRaw.replace(/\D/g, ""));
	let fracDigits = fracRaw.replace(/\D/g, "");
	if (maxDecimals !== undefined && maxDecimals >= 0) {
		fracDigits = fracDigits.slice(0, maxDecimals);
	}

	if (max !== undefined) {
		const numVal = Number(`${intDigits || "0"}.${fracDigits || "0"}`);
		if (numVal > max) {
			intDigits = String(max);
			fracDigits = "";
			hasDecimal = false;
		}
	}

	if (intDigits === "" && fracDigits === "" && !hasDecimal) return "";
	const head = intDigits === "" ? "0" : intDigits;
	const prefix = `${negative ? "-" : ""}${head}`;
	if (!hasDecimal) return prefix;
	return `${prefix}.${fracDigits}`;
}

export function formatGroupedInput(
	rawValue: string,
	allowDecimal: boolean,
): string {
	const trimmed = rawValue.trim();
	if (trimmed === "" || trimmed === "-") return trimmed;
	const negative = trimmed.startsWith("-");
	const unsigned = negative ? trimmed.slice(1) : trimmed;
	const [intRaw, ...fracParts] = unsigned.split(".");
	const grouped = groupThousands(intRaw ?? "");
	if (!allowDecimal || fracParts.length === 0) {
		if (grouped === "") return negative ? "-" : "";
		return `${negative ? "-" : ""}${grouped}`;
	}
	const frac = fracParts.join("").replace(/\D/g, "");
	return `${negative ? "-" : ""}${grouped === "" ? "0" : grouped},${frac}`;
}

type FormattedNumberInputProps = Omit<
	InputHTMLAttributes<HTMLInputElement>,
	"type" | "value" | "defaultValue" | "onChange" | "step" | "min" | "max"
> & {
	value?: string | number;
	defaultValue?: string | number;
	allowDecimal?: boolean;
	maxDecimals?: number;
	max?: number;
	min?: number;
	onChange?: (rawValue: string) => void;
};

export function FormattedNumberInput({
	value,
	defaultValue,
	allowDecimal = false,
	maxDecimals,
	max,
	onChange,
	onKeyDown,
	...rest
}: FormattedNumberInputProps) {
	const [text, setText] = useState(() =>
		formatGroupedInput(String(value ?? defaultValue ?? ""), allowDecimal),
	);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const caretRef = useRef<number | null>(null);

	useEffect(() => {
		if (value === undefined) return;
		const next = formatGroupedInput(String(value), allowDecimal);
		setText((prev) => (prev === next ? prev : next));
	}, [value, allowDecimal]);

	useLayoutEffect(() => {
		if (caretRef.current === null || !inputRef.current) return;
		const pos = Math.min(caretRef.current, inputRef.current.value.length);
		inputRef.current.setSelectionRange(pos, pos);
		caretRef.current = null;
	});

	const processInput = (typed: string, caret: number) => {
		const textBeforeCaret = typed.slice(0, caret);
		const hasCommaBeforeCaret = allowDecimal && textBeforeCaret.includes(",");
		const intDigitsBefore = (
			(hasCommaBeforeCaret
				? textBeforeCaret.slice(0, textBeforeCaret.indexOf(","))
				: textBeforeCaret
			).match(DIGIT_PATTERN) ?? []
		).length;
		const fracDigitsBefore = hasCommaBeforeCaret
			? (
					textBeforeCaret
						.slice(textBeforeCaret.indexOf(",") + 1)
						.match(DIGIT_PATTERN) ?? []
				).length
			: 0;

		const raw = parseGroupedInput(typed, allowDecimal, maxDecimals, max);
		const next = formatGroupedInput(raw, allowDecimal);

		if (raw === "-") {
			caretRef.current = 1;
		} else if (hasCommaBeforeCaret) {
			const nextCommaIdx = next.indexOf(",");
			if (nextCommaIdx >= 0) {
				const effectiveFracBefore =
					maxDecimals !== undefined
						? Math.min(fracDigitsBefore, maxDecimals)
						: fracDigitsBefore;
				caretRef.current = nextCommaIdx + 1 + effectiveFracBefore;
			} else {
				caretRef.current = next.length;
			}
		} else if (intDigitsBefore === 0) {
			caretRef.current = next.startsWith("-") ? 1 : 0;
		} else {
			let seen = 0;
			let pos = next.length;
			for (let i = 0; i < next.length; i += 1) {
				if (SINGLE_DIGIT.test(next.charAt(i))) seen += 1;
				if (seen === intDigitsBefore) {
					pos = i + 1;
					break;
				}
			}
			caretRef.current = pos;
		}
		setText(next);
		onChange?.(raw);
	};

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const typed = event.target.value;
		const caret = event.target.selectionStart ?? typed.length;
		processInput(typed, caret);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (allowDecimal) {
			if (event.key === ".") {
				event.preventDefault();
				const target = event.currentTarget;
				const start = target.selectionStart ?? target.value.length;
				const end = target.selectionEnd ?? target.value.length;
				if (!target.value.includes(",")) {
					const before = target.value.slice(0, start);
					const after = target.value.slice(end);
					const newTyped = `${before},${after}`;
					processInput(newTyped, start + 1);
				}
				return;
			}
			if (event.key === "," && text.includes(",")) {
				const target = event.currentTarget;
				const start = target.selectionStart ?? 0;
				const end = target.selectionEnd ?? 0;
				const selectedHasComma = target.value.slice(start, end).includes(",");
				if (!selectedHasComma) {
					event.preventDefault();
					return;
				}
			}
		} else {
			if (event.key === "," || event.key === ".") {
				event.preventDefault();
				return;
			}
		}
		onKeyDown?.(event);
	};

	return (
		<input
			{...rest}
			ref={inputRef}
			type="text"
			inputMode={allowDecimal ? "decimal" : "numeric"}
			autoComplete="off"
			spellCheck={false}
			value={text}
			onChange={handleChange}
			onKeyDown={handleKeyDown}
		/>
	);
}
