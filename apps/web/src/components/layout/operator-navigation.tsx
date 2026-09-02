import type { LucideIcon } from "lucide-react";
import {
	BookOpen,
	Calculator,
	ChartLine,
	Database,
	FileText,
	History,
	LayoutDashboard,
	MoreHorizontal,
	Settings,
	Upload,
} from "lucide-react";
import { Dialog } from "radix-ui";
import type { ComponentProps } from "react";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { SignOutAction } from "@/components/auth/sign-out-action";
import { useActiveContext } from "./active-context";

type NavigationItem = {
	label: string;
	href: string;
	icon: LucideIcon;
};

const primaryItems: readonly NavigationItem[] = [
	{ label: "Dashboard", href: "/operator/dashboard", icon: LayoutDashboard },
	{ label: "Simulasi", href: "/operator/simulation", icon: Calculator },
];

const inputItems: readonly NavigationItem[] = [
	{
		label: "Pagu & Revisi DIPA",
		href: "/operator/data/budget-revisions",
		icon: FileText,
	},
	{
		label: "RPD & Realisasi",
		href: "/operator/data/rpd-realization",
		icon: FileText,
	},
	{
		label: "Kontrak & Tagihan",
		href: "/operator/data/contracts-invoices",
		icon: FileText,
	},
	{ label: "UP/TUP & KKP", href: "/operator/data/up-tup-kkp", icon: FileText },
	{
		label: "Capaian Output",
		href: "/operator/data/output-achievement",
		icon: ChartLine,
	},
	{
		label: "SPM Dispensasi",
		href: "/operator/data/spm-dispensation",
		icon: FileText,
	},
	{ label: "Import Data", href: "/operator/import", icon: Upload },
];

const secondaryItems: readonly NavigationItem[] = [
	{ label: "Skenario & Riwayat", href: "/operator/history", icon: History },
	{
		label: "Analisis & Rekomendasi",
		href: "/operator/analysis",
		icon: ChartLine,
	},
	{ label: "Reminder Center", href: "/operator/reminders", icon: Database },
	{ label: "Laporan & Ekspor", href: "/operator/reports", icon: FileText },
	{ label: "Panduan IKPA", href: "/operator/guides", icon: BookOpen },
	{ label: "Pengaturan Satker", href: "/operator/settings", icon: Settings },
];

const mobileItems: readonly NavigationItem[] = [
	primaryItems[0],
	primaryItems[1],
	{ label: "Input", href: "/operator/data/budget-revisions", icon: Database },
	{ label: "Reminder", href: "/operator/reminders", icon: Database },
];

const moreItems: readonly NavigationItem[] = [
	...secondaryItems.filter((item) => item.label !== "Reminder Center"),
	{ label: "Pilih Satker", href: "/select-organization", icon: Database },
];

export type OperatorNavigationProps = Omit<
	ComponentProps<"div">,
	"children"
> & {
	currentPath: string;
};

function normalizedPath(path: string): string {
	return path.split(/[?#]/, 1)[0] || "/";
}

export function isOperatorRouteActive(
	currentPath: string,
	href: string,
): boolean {
	const path = normalizedPath(currentPath);
	const target = normalizedPath(href).replace(/\/$/, "") || "/";

	return path === target || (target !== "/" && path.startsWith(`${target}/`));
}

function navigationLinkClass(active: boolean, compact = false): string {
	return twMerge(
		"group inline-flex items-center gap-3 rounded-md text-left text-body-small text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground",
		compact
			? "min-h-16 flex-col justify-center gap-1 px-1 text-center text-[0.6875rem]"
			: "min-h-10 w-full px-3 py-2",
		active && "bg-primary/10 text-primary",
	);
}

function NavigationLink({
	item,
	currentPath,
	compact = false,
}: {
	item: NavigationItem;
	currentPath: string;
	compact?: boolean;
}) {
	const Icon = item.icon;
	const active = isOperatorRouteActive(currentPath, item.href);

	return (
		<a
			aria-current={active ? "page" : undefined}
			className={navigationLinkClass(active, compact)}
			data-active={active ? "true" : undefined}
			href={item.href}
		>
			<Icon aria-hidden="true" className="size-4 shrink-0" />
			<span className={compact ? "max-w-full truncate" : "truncate"}>
				{item.label}
			</span>
		</a>
	);
}

function SectionLabel({ children }: { children: string }) {
	return <p className="px-3 text-label text-muted-foreground">{children}</p>;
}

export function OperatorNavigation({
	currentPath,
	className,
	...props
}: OperatorNavigationProps) {
	const [isMoreOpen, setIsMoreOpen] = useState(false);
	const moreIsActive = moreItems.some((item) =>
		isOperatorRouteActive(currentPath, item.href),
	);
	const activeCtx = useActiveContext();
	const satkerName = activeCtx?.context.activeOrganization?.name ?? "Operator Satker";
	const satkerCode = activeCtx?.context.activeOrganization?.code ?? "";

	return (
		<div
			{...props}
			className={twMerge("md:w-64 md:shrink-0", className)}
			data-slot="operator-navigation"
		>
			<aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-border bg-surface md:flex">
				<div className="border-b border-border p-5">
					<div className="flex items-center gap-3">
						<span
							aria-hidden="true"
							className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-label text-primary-foreground"
						>
							SI
						</span>
						<div>
							<p className="text-label text-foreground">Simulator IKPA</p>
							<p className="text-body-small text-muted-foreground">
								Operator Satker
							</p>
						</div>
					</div>
				</div>
				<nav aria-label="Navigasi Operator" className="flex-1 space-y-5 p-4">
					<div className="space-y-1">
						{primaryItems.map((item) => (
							<NavigationLink
								currentPath={currentPath}
								item={item}
								key={item.href}
							/>
						))}
					</div>
					<div className="space-y-2">
						<SectionLabel>Input Data</SectionLabel>
						<div className="space-y-1 pl-2">
							{inputItems.map((item) => (
								<NavigationLink
									currentPath={currentPath}
									item={item}
									key={item.href}
								/>
							))}
						</div>
					</div>
					<div className="space-y-1">
						{secondaryItems.map((item) => (
							<NavigationLink
								currentPath={currentPath}
								item={item}
								key={item.href}
							/>
						))}
					</div>
				</nav>
				<div className="border-t border-border p-4">
					<p className="text-body-small text-muted-foreground">Akun aktif</p>
					<p
						className="mt-1 truncate text-label text-foreground"
						title={satkerName}
					>
						{satkerName}
					</p>
					{satkerCode ? (
						<p className="text-[11px] text-muted-foreground">Kode: {satkerCode}</p>
					) : null}
					<SignOutAction className="mt-3 inline-flex min-h-10 items-center text-body-small text-primary underline-offset-4 hover:underline">
						Keluar
					</SignOutAction>
				</div>
			</aside>

			<div className="md:hidden">
				<nav
					aria-label="Navigasi utama Operator"
					className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur"
				>
					<div className="mx-auto grid max-w-lg grid-cols-5">
						{mobileItems.map((item) => (
							<NavigationLink
								compact
								currentPath={currentPath}
								item={item}
								key={item.href}
							/>
						))}
						<Dialog.Root open={isMoreOpen} onOpenChange={setIsMoreOpen}>
							<Dialog.Trigger asChild>
								<button
									aria-expanded={isMoreOpen}
									aria-haspopup="dialog"
									className={navigationLinkClass(moreIsActive, true)}
									data-active={moreIsActive ? "true" : undefined}
									type="button"
								>
									<MoreHorizontal
										aria-hidden="true"
										className="size-4 shrink-0"
									/>
									<span>Lainnya</span>
								</button>
							</Dialog.Trigger>
							<Dialog.Portal>
								<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
								<Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border border-border bg-background p-5 shadow-lg outline-none sm:mx-auto sm:max-w-lg">
									<div className="flex items-center justify-between gap-4">
										<Dialog.Title className="text-h3">
											Menu Operator
										</Dialog.Title>
										<Dialog.Close asChild>
											<button
												className="min-h-10 rounded-md px-3 py-2 text-label text-muted-foreground hover:bg-surface-muted hover:text-foreground"
												type="button"
											>
												Tutup
											</button>
										</Dialog.Close>
									</div>
									<Dialog.Description className="mt-1 text-body-small text-muted-foreground">
										Pilih menu operasional lainnya.
									</Dialog.Description>
									<nav
										aria-label="Menu lainnya Operator"
										className="mt-4 grid gap-1"
									>
										{moreItems.map((item) => (
											<NavigationLink
												currentPath={currentPath}
												item={item}
												key={item.href}
											/>
										))}
									</nav>
									<div className="mt-4 border-t border-border pt-3">
										<SignOutAction className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-surface-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface">
											Keluar dari Sesi Operator
										</SignOutAction>
									</div>
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>
					</div>
				</nav>
			</div>
		</div>
	);
}
