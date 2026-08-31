import type { LucideIcon } from "lucide-react";
import {
	Building2,
	CalendarRange,
	ClipboardList,
	FileText,
	KeyRound,
	LayoutDashboard,
	LockKeyhole,
	MoreHorizontal,
	TriangleAlert,
} from "lucide-react";
import { Dialog } from "radix-ui";
import type { ComponentProps } from "react";
import { useState } from "react";
import { twMerge } from "tailwind-merge";

type NavigationItem = {
	label: string;
	href: string;
	icon: LucideIcon;
};

const dashboardItem: NavigationItem = {
	label: "Dashboard Monitoring",
	href: "/admin-kppn/dashboard",
	icon: LayoutDashboard,
};

const satkerItems: readonly NavigationItem[] = [
	{ label: "Daftar Satker", href: "/admin-kppn/satker", icon: Building2 },
	{
		label: "Risiko & Reminder",
		href: "/admin-kppn/risks",
		icon: TriangleAlert,
	},
];

const policyItems: readonly NavigationItem[] = [
	{
		label: "Rule Set IKPA",
		href: "/admin-kppn/policy/rule-sets",
		icon: LockKeyhole,
	},
	{
		label: "Reminder Policy",
		href: "/admin-kppn/policy/reminders",
		icon: LockKeyhole,
	},
	{
		label: "Kalender Hari Kerja",
		href: "/admin-kppn/policy/workdays",
		icon: CalendarRange,
	},
	{
		label: "Riwayat Versi",
		href: "/admin-kppn/policy/history",
		icon: ClipboardList,
	},
];

const secondaryItems: readonly NavigationItem[] = [
	{ label: "Laporan Agregat", href: "/admin-kppn/reports", icon: FileText },
	{ label: "Audit Log", href: "/admin-kppn/audit-logs", icon: ClipboardList },
	{ label: "Manajemen Akses", href: "/admin-kppn/access", icon: KeyRound },
];

const mobileItems: readonly NavigationItem[] = [
	dashboardItem,
	{ label: "Satker", href: "/admin-kppn/satker", icon: Building2 },
	{ label: "Risiko", href: "/admin-kppn/risks", icon: TriangleAlert },
	{ label: "Policy", href: "/admin-kppn/policy", icon: LockKeyhole },
];

const moreItems: readonly NavigationItem[] = [
	...secondaryItems,
	{
		label: "Tahun & Periode",
		href: "/admin-kppn/context",
		icon: CalendarRange,
	},
	{ label: "Keluar", href: "/sign-out", icon: KeyRound },
];

export type AdminNavigationProps = Omit<ComponentProps<"div">, "children"> & {
	currentPath: string;
};

function normalizedPath(path: string): string {
	return path.split(/[?#]/, 1)[0] || "/";
}

export function isAdminRouteActive(currentPath: string, href: string): boolean {
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
	const active = isAdminRouteActive(currentPath, item.href);

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

export function AdminNavigation({
	currentPath,
	className,
	...props
}: AdminNavigationProps) {
	const [isMoreOpen, setIsMoreOpen] = useState(false);
	const moreIsActive = moreItems.some((item) =>
		isAdminRouteActive(currentPath, item.href),
	);

	return (
		<div
			{...props}
			className={twMerge("md:w-64 md:shrink-0", className)}
			data-slot="admin-navigation"
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
								Admin KPPN
							</p>
						</div>
					</div>
				</div>
				<nav aria-label="Navigasi Admin KPPN" className="flex-1 space-y-5 p-4">
					<div className="space-y-1">
						<NavigationLink currentPath={currentPath} item={dashboardItem} />
					</div>
					<div className="space-y-2">
						<SectionLabel>Satker</SectionLabel>
						<div className="space-y-1 pl-2">
							{satkerItems.map((item) => (
								<NavigationLink
									currentPath={currentPath}
									item={item}
									key={item.href}
								/>
							))}
						</div>
					</div>
					<div className="space-y-1">
						<NavigationLink
							currentPath={currentPath}
							item={secondaryItems[0]}
						/>
					</div>
					<div className="space-y-2">
						<SectionLabel>Admin Policy</SectionLabel>
						<div className="space-y-1 pl-2">
							{policyItems.map((item) => (
								<NavigationLink
									currentPath={currentPath}
									item={item}
									key={item.href}
								/>
							))}
						</div>
					</div>
					<div className="space-y-1">
						{secondaryItems.slice(1).map((item) => (
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
					<p className="mt-1 text-label text-foreground">Admin KPPN</p>
					<a
						className="mt-3 inline-flex min-h-10 items-center text-body-small text-primary underline-offset-4 hover:underline"
						href="/sign-out"
					>
						Keluar
					</a>
				</div>
			</aside>

			<div className="md:hidden">
				<div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
					<span
						aria-hidden="true"
						className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-label text-primary-foreground"
					>
						SI
					</span>
					<div>
						<p className="text-label text-foreground">Admin KPPN</p>
						<p className="text-body-small text-muted-foreground">
							Simulator IKPA
						</p>
					</div>
				</div>
				<nav
					aria-label="Navigasi utama Admin KPPN"
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
											Menu Admin KPPN
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
										Pilih menu administrasi KPPN lainnya.
									</Dialog.Description>
									<nav
										aria-label="Menu lainnya Admin KPPN"
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
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>
					</div>
				</nav>
			</div>
		</div>
	);
}
