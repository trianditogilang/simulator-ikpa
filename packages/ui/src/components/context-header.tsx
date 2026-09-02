import { Dialog } from "radix-ui";
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

// ponytail: legacy seed used KPPN-089 Jakarta II before feedback 032 Malang; normalize display without requiring DB re-seed
// ceiling = DB migration if scope table ever diverges; keep mapping minimal
function normalizeKppnScope(
	scope: { code: string; name: string } | null | undefined,
): { code: string; name: string } | null | undefined {
	if (!scope) return scope;
	// handle legacy Jakarta II seeded as KPPN-089 for admin 032 Malang
	if (
		scope.code === "KPPN-089" ||
		scope.code === "089" ||
		scope.name === "KPPN Jakarta II"
	) {
		return { ...scope, code: "KPPN-032", name: "KPPN Malang" };
	}
	// normalize bare 032 to prefixed form expected in feedback
	if (scope.code === "032") {
		return { ...scope, code: "KPPN-032" };
	}
	return scope;
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
	const rawScope = isAdmin ? context.activeKppnScope : context.activeOrganization;
	const scope = isAdmin
		? (normalizeKppnScope(rawScope as { code: string; name: string } | null) as typeof rawScope)
		: rawScope;
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
							<Dialog.Root>
								<Dialog.Trigger asChild>
									<button
										type="button"
										aria-label="Penjelasan Rule Set belum tersedia"
										className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									>
										<StatusBadge
											status="incomplete"
											label="Rule Set belum tersedia"
											className="cursor-pointer hover:bg-surface-muted"
										/>
									</button>
								</Dialog.Trigger>
								<Dialog.Portal>
									<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
									<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-5 shadow-lg outline-none">
										<Dialog.Title className="text-sm font-semibold text-foreground">
											Rule Set belum tersedia di header
										</Dialog.Title>
										<Dialog.Description className="mt-2 text-xs leading-relaxed text-muted-foreground">
											Versi <strong className="text-foreground">2026.1</strong> sudah terbit di{" "}
											<strong className="text-foreground">Kebijakan → Rule Set IKPA</strong>{" "}
											dan dapat dilihat di{" "}
											<code className="rounded bg-surface-muted px-1 py-0.5 text-[11px]">/admin-kppn/policy/rule-sets</code>
											. Header menampilkan Rule Set aktif untuk tahun anggaran{" "}
											<strong className="text-foreground">{context.fiscalYear.year}</strong> pada
											satker/KPPN Anda. Jika masih “belum tersedia”, tahun anggaran 2026
											belum diinisialisasi untuk satker ini atau Rule Set belum dipublish.
											Hubungi <strong>Admin KPPN</strong> atau cek halaman Rule Set.
										</Dialog.Description>
										<div className="mt-4 flex justify-end gap-2">
											<Dialog.Close asChild>
												<button
													type="button"
													className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
												>
													Mengerti
												</button>
											</Dialog.Close>
											<a
												href="/admin-kppn/policy/rule-sets"
												className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
											>
												Buka Rule Set
											</a>
										</div>
									</Dialog.Content>
								</Dialog.Portal>
							</Dialog.Root>
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
