import type { FiscalPeriod } from "@simulator-ikpa/contracts";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type ContextSelectorProps = Omit<
	ComponentProps<"fieldset">,
	"children"
> & {
	year: number;
	period: FiscalPeriod;
	yearOptions?: readonly number[];
	periodOptions?: readonly FiscalPeriod[];
	onYearChange?: (year: number) => void;
	onPeriodChange?: (period: FiscalPeriod) => void;
	disabled?: boolean;
};

const periodKindLabels: Record<FiscalPeriod["kind"], string> = {
	month: "Bulan",
	quarter: "Triwulan",
	semester: "Semester",
	year: "Tahunan",
};

export function formatFiscalPeriod(period: FiscalPeriod): string {
	if (period.kind === "year") {
		return periodKindLabels.year;
	}

	return `${periodKindLabels[period.kind]} ${period.value}`;
}

function periodKey(period: FiscalPeriod): string {
	return `${period.kind}:${period.value}`;
}

const selectClassName =
	"min-w-0 rounded-md border border-input bg-background px-2.5 py-2 text-label text-foreground shadow-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export function ContextSelector({
	year,
	period,
	yearOptions = [year],
	periodOptions = [period],
	onYearChange,
	onPeriodChange,
	disabled = false,
	className,
	...props
}: ContextSelectorProps) {
	const yearSelectDisabled =
		disabled || !onYearChange || yearOptions.length < 2;
	const periodSelectDisabled =
		disabled || !onPeriodChange || periodOptions.length < 2;

	return (
		<fieldset
			data-slot="context-selector"
			className={twMerge(
				"grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:items-end",
				className,
			)}
			{...props}
		>
			<legend className="sr-only">Tahun dan periode aktif</legend>
			<label className="grid min-w-0 gap-1 text-label text-muted-foreground md:min-w-32">
				<span>Tahun</span>
				<select
					aria-label="Tahun anggaran"
					className={selectClassName}
					disabled={yearSelectDisabled}
					value={String(year)}
					onChange={(event) => {
						const nextYear = Number(event.currentTarget.value);
						if (Number.isSafeInteger(nextYear)) {
							onYearChange?.(nextYear);
						}
					}}
				>
					{yearOptions.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			</label>
			<label className="grid min-w-0 gap-1 text-label text-muted-foreground md:min-w-40">
				<span>Periode</span>
				<select
					aria-label="Periode penilaian"
					className={selectClassName}
					disabled={periodSelectDisabled}
					value={periodKey(period)}
					onChange={(event) => {
						const nextPeriod = periodOptions.find(
							(option) => periodKey(option) === event.currentTarget.value,
						);
						if (nextPeriod) {
							onPeriodChange?.(nextPeriod);
						}
					}}
				>
					{periodOptions.map((option) => (
						<option key={periodKey(option)} value={periodKey(option)}>
							{formatFiscalPeriod(option)}
						</option>
					))}
				</select>
			</label>
		</fieldset>
	);
}
