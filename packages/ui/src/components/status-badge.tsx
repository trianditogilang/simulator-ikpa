import { cva, type VariantProps } from "class-variance-authority";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	HelpCircle,
	Info,
	Lock,
	type LucideIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

const statusBadgeVariants = cva(
	"inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-label whitespace-nowrap",
	{
		variants: {
			status: {
				complete: "border-success/30 bg-success-surface text-success",
				warning: "border-warning/30 bg-warning-surface text-warning",
				danger: "border-danger/30 bg-danger-surface text-danger",
				info: "border-info/30 bg-info-surface text-info",
				incomplete: "border-border bg-surface-muted text-foreground",
				locked: "border-primary/20 bg-primary/10 text-primary",
			},
		},
		defaultVariants: {
			status: "info",
		},
	},
);

export type StatusBadgeStatus = NonNullable<
	VariantProps<typeof statusBadgeVariants>["status"]
>;

const statusLabels: Record<StatusBadgeStatus, string> = {
	complete: "Aman / Lengkap",
	warning: "Perlu perhatian",
	danger: "Risiko tinggi / Terlambat",
	info: "Informasi / Diproses",
	incomplete: "Data belum lengkap",
	locked: "Dikunci oleh policy",
};

const statusIcons: Record<StatusBadgeStatus, LucideIcon> = {
	complete: CheckCircle2,
	warning: AlertTriangle,
	danger: AlertCircle,
	info: Info,
	incomplete: HelpCircle,
	locked: Lock,
};

export type StatusBadgeProps = Omit<ComponentProps<"output">, "children"> & {
	status: StatusBadgeStatus;
	label?: string;
};

export function StatusBadge({
	status,
	label = statusLabels[status],
	className,
	...props
}: StatusBadgeProps) {
	const Icon = statusIcons[status];

	return (
		<output
			aria-label={label}
			data-slot="status-badge"
			data-status={status}
			className={twMerge(statusBadgeVariants({ status }), className)}
			{...props}
		>
			<Icon aria-hidden="true" className="size-3.5 shrink-0" />
			<span>{label}</span>
		</output>
	);
}
