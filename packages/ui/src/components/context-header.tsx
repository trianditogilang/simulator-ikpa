import type { FiscalPeriod, GlobalContext } from "@simulator-ikpa/contracts";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { ContextSelector } from "./context-selector";
import { RuleSetBadge } from "./rule-set-badge";
import { StatusBadge } from "./status-badge";

export type ContextHeaderProps = Omit<ComponentProps<"header">, "children"> & {
	context: GlobalContext;
	yearOptions?: readonly number[];
	periodOptions?: readonly FiscalPeriod[];
	onYearChange?: (year: number) => void;
	onPeriodChange?: (period: FiscalPeriod) => void;
};

function isOperatorAccess(access: GlobalContext["access"]): boolean {
	return (
		access.status === "operator_single_scope" ||
		access.status === "operator_multiple_scopes"
	);
}

export function ContextHeader({
	context,
	yearOptions,
	periodOptions,
	onYearChange,
	onPeriodChange,
	className,
	...props
}: ContextHeaderProps) {
	const isAdmin = context.access.status === "admin";
	const scope = isAdmin ? context.activeKppnScope : context.activeOrganization;
	const scopeLabel = isAdmin ? "KPPN Scope" : "Satker";
	const scopeName =
		scope?.name ??
		(isAdmin ? "KPPN scope belum dipilih" : "Satker belum dipilih");
	const accessLabel = isAdmin
		? "Admin KPPN"
		: isOperatorAccess(context.access)
			? "Operator Satker"
			: "Akses belum ditetapkan";
	const accessType = isAdmin
		? "admin_kppn"
		: isOperatorAccess(context.access)
			? "operator_satker"
			: undefined;
	const accessBadgeClass =
		isAdmin || isOperatorAccess(context.access)
			? "border-primary/20 bg-primary/10 text-primary"
			: "border-warning/30 bg-warning-surface text-warning";

	return (
		<header
			data-slot="context-header"
			data-access-type={accessType}
			className={twMerge(
				"border-b border-border bg-background px-4 py-3 md:px-6",
				className,
			)}
			{...props}
		>
			<div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="min-w-0">
					<p className="text-label text-muted-foreground">{scopeLabel}</p>
					<div className="flex min-w-0 items-baseline gap-2">
						<h1 className="truncate text-h3">{scopeName}</h1>
						{scope?.code ? (
							<span className="shrink-0 text-body-small text-muted-foreground">
								{scope.code}
							</span>
						) : null}
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<span
							data-slot="access-badge"
							data-access={accessType}
							className={twMerge(
								"inline-flex items-center rounded-full border px-2 py-1 text-label",
								accessBadgeClass,
							)}
						>
							{accessLabel}
						</span>
						{context.ruleSet ? (
							<RuleSetBadge
								year={context.fiscalYear.year}
								version={context.ruleSet.version}
								status={context.ruleSet.status}
							/>
						) : (
							<StatusBadge
								status="incomplete"
								label="Rule Set belum tersedia"
							/>
						)}
					</div>
				</div>
				<ContextSelector
					year={context.fiscalYear.year}
					period={context.period}
					yearOptions={yearOptions}
					periodOptions={periodOptions}
					onYearChange={onYearChange}
					onPeriodChange={onPeriodChange}
					className="md:shrink-0"
				/>
			</div>
		</header>
	);
}
