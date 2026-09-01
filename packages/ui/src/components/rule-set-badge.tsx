import { cva, type VariantProps } from "class-variance-authority";
import { Archive, CheckCircle2, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

const ruleSetBadgeVariants = cva(
	"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label whitespace-nowrap",
	{
		variants: {
			status: {
				published: "border-primary/25 bg-surface text-primary",
				retired: "border-border bg-surface-muted text-muted-foreground",
			},
		},
		defaultVariants: {
			status: "published",
		},
	},
);

export type RuleSetBadgeStatus = NonNullable<
	VariantProps<typeof ruleSetBadgeVariants>["status"]
>;

const statusLabels: Record<RuleSetBadgeStatus, string> = {
	published: "Published",
	retired: "Retired",
};

const statusIcons: Record<RuleSetBadgeStatus, LucideIcon> = {
	published: CheckCircle2,
	retired: Archive,
};

export type RuleSetBadgeProps = Omit<ComponentProps<"output">, "children"> & {
	year: number;
	version: number;
	status: RuleSetBadgeStatus;
};

export function RuleSetBadge({
	year,
	version,
	status,
	className,
	...props
}: RuleSetBadgeProps) {
	const Icon = statusIcons[status];
	const statusLabel = statusLabels[status];
	const accessibleLabel = `Rule Set ${year}.${version}, ${statusLabel}`;

	return (
		<output
			aria-label={accessibleLabel}
			data-slot="rule-set-badge"
			data-status={status}
			className={twMerge(ruleSetBadgeVariants({ status }), className)}
			{...props}
		>
			<Icon aria-hidden="true" className="size-3.5 shrink-0" />
			<span>
				Rule Set {year}.{version}
			</span>
			<span aria-hidden="true">/</span>
			<span>{statusLabel}</span>
		</output>
	);
}
