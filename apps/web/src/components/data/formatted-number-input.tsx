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
): string {
	const cleaned = displayValue.replace(/[^0-9,.-]/g, "");
	if (cleaned === "") return "";
	const negative = cleaned.startsWith("-");
	const unsigned = negative ? cleaned.slice(1) : cleaned;
	if (!allowDecimal) {
		const digits = stripLeadingZeros(unsigned.replace(/\D/g, ""));
		if (digits === "") return "";
		return `${negative ? "-" : ""}${digits}`;
	}
	const sepIndex = Math.max(
		unsigned.lastIndexOf(","),
		unsigned.lastIndexOf("."),
	);
	const intRaw = sepIndex >= 0 ? unsigned.slice(0, sepIndex) : unsigned;
	const fracRaw = sepIndex >= 0 ? unsigned.slice(sepIndex + 1) : "";
	const intDigits = stripLeadingZeros(intRaw.replace(/\D/g, ""));
	const fracDigits = fracRaw.replace(/\D/g, "");
	if (intDigits === "" && fracDigits === "") return "";
	const head = intDigits === "" ? "0" : intDigits;
	const prefix = `${negative ? "-" : ""}${head}`;
	if (sepIndex < 0) return prefix;
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
	onChange?: (rawValue: string) => void;
};

export function FormattedNumberInput({
	value,
	defaultValue,
	allowDecimal = false,
	onChange,
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

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const typed = event.target.value;
		const caret = event.target.selectionStart ?? typed.length;
		const digitsBefore = (typed.slice(0, caret).match(DIGIT_PATTERN) ?? []).length;
		const raw = parseGroupedInput(typed, allowDecimal);
		const next = formatGroupedInput(raw, allowDecimal);
		if (raw === "-") {
			caretRef.current = 1;
		} else if (digitsBefore === 0) {
			caretRef.current = next.startsWith("-") ? 1 : 0;
		} else {
			let seen = 0;
			let pos = next.length;
			for (let i = 0; i < next.length; i += 1) {
				if (SINGLE_DIGIT.test(next.charAt(i))) seen += 1;
				if (seen === digitsBefore) {
					pos = i + 1;
					break;
				}
			}
			caretRef.current = pos;
		}
		setText(next);
		onChange?.(raw);
	};

	return (
		<input
			{...rest}
			ref={inputRef}
			type="text"
			inputMode="decimal"
			autoComplete="off"
			spellCheck={false}
			value={text}
			onChange={handleChange}
		/>
	);
}
