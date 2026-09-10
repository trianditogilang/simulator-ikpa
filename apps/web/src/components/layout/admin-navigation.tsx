import type { LucideIcon } from "lucide-react";
import {
	Building2,
	CalendarRange,
	ClipboardList,
	KeyRound,
	LayoutDashboard,
	LockKeyhole,
	MoreHorizontal,
	Scale,
	TriangleAlert,
} from "lucide-react";
import { useUser } from "@clerk/tanstack-react-start";
import { Dialog } from "radix-ui";
import type { ComponentProps } from "react";
import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { SignOutAction } from "@/components/auth/sign-out-action";

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
	{
		label: "Daftar Satker",
		href: "/admin-kppn/organizations",
		icon: Building2,
	},
	{
		label: "Risiko & Reminder",
		href: "/admin-kppn/monitoring/reminders",
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
		label: "Fairness Treatment",
		href: "/admin-kppn/policy/fairness",
		icon: Scale,
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
	{ label: "Audit Log", href: "/admin-kppn/audit-logs", icon: ClipboardList },
	{ label: "Manajemen Akses", href: "/admin-kppn/access", icon: KeyRound },
];

const mobileItems: readonly NavigationItem[] = [
	dashboardItem,
	{ label: "Satker", href: "/admin-kppn/organizations", icon: Building2 },
	{
		label: "Risiko",
		href: "/admin-kppn/monitoring/reminders",
		icon: TriangleAlert,
	},
	{ label: "Policy", href: "/admin-kppn/policy/rule-sets", icon: LockKeyhole },
];

const moreItems: readonly NavigationItem[] = [...secondaryItems];

function toTitleCaseKppn(value: string): string {
	return value
		.split(" ")
		.map((w) => {
			const lower = w.toLowerCase();
			if (lower === "kppn") return "KPPN";
			return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
		})
		.join(" ");
}

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
	onClick,
}: {
	item: NavigationItem;
	currentPath: string;
	compact?: boolean;
	onClick?: () => void;
}) {
	const Icon = item.icon;
	const active = isAdminRouteActive(currentPath, item.href);

	return (
		<a
			aria-current={active ? "page" : undefined}
			className={navigationLinkClass(active, compact)}
			data-active={active ? "true" : undefined}
			href={item.href}
			onClick={onClick}
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

type AdminNavigationProfile = {
	clerkName?: string | null;
	clerkEmail?: string | null;
};

export function AdminNavigation(props: AdminNavigationProps) {
	if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
		return <ClerkAdminNavigation {...props} />;
	}
	return <AdminNavigationContent {...props} />;
}

function ClerkAdminNavigation(props: AdminNavigationProps) {
	const { user, isLoaded } = useUser();
	const clerkName =
		isLoaded && user
			? ((user.fullName as string | null) ||
					(user.firstName as string | null) ||
					(user.primaryEmailAddress?.emailAddress as string | null) ||
					null)
			: null;
	const clerkEmail =
		isLoaded && user
				? ((user.primaryEmailAddress?.emailAddress as string | null) ?? null)
				: null;
	return <AdminNavigationContent {...props} clerkName={clerkName} clerkEmail={clerkEmail} />;
}

function AdminNavigationContent({
	currentPath,
	className,
	clerkName = null,
	clerkEmail = null,
	...props
}: AdminNavigationProps & AdminNavigationProfile) {
	const [isMoreOpen, setIsMoreOpen] = useState(false);
	const moreIsActive = moreItems.some((item) =>
		isAdminRouteActive(currentPath, item.href),
	);
	const displayName = clerkName || "Admin KPPN Malang";
	const displayEmail = clerkEmail || "admin.kppn@kemenkeu.go.id";
	const displayInitial = displayName.charAt(0).toUpperCase();

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
							{displayInitial}
						</span>
						<div className="min-w-0">
							<p className="text-label text-foreground">Simulator IKPA</p>
							<p className="truncate text-body-small text-muted-foreground">
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
					<p
						className="mt-1 truncate text-label text-foreground"
						title={displayEmail}
					>
						{toTitleCaseKppn(displayName)}
					</p>
					<p className="truncate text-[11px] text-muted-foreground" title={displayEmail}>
						{displayEmail}
					</p>
					<SignOutAction className="mt-3 inline-flex min-h-10 items-center text-body-small text-primary underline-offset-4 hover:underline">
						Keluar
					</SignOutAction>
				</div>
			</aside>

			<div className="md:hidden">
				<div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
					<span
						aria-hidden="true"
						className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-label text-primary-foreground"
					>
						{displayInitial}
					</span>
					<div className="min-w-0">
						<p className="truncate text-label text-foreground">Admin KPPN</p>
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
								<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs" />
								<Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border border-border bg-background shadow-2xl outline-none sm:mx-auto sm:max-w-lg">
									<div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-border" aria-hidden="true" />
									<div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-5 pb-3 pt-2">
										<div>
											<Dialog.Title className="text-sm font-bold text-foreground sm:text-base">
												Menu Admin KPPN
											</Dialog.Title>
											<Dialog.Description className="text-xs text-muted-foreground">
												Pilih menu administrasi KPPN lainnya.
											</Dialog.Description>
										</div>
										<Dialog.Close asChild>
											<button
												className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface hover:text-foreground transition"
												type="button"
											>
												Tutup
											</button>
										</Dialog.Close>
									</div>
									<nav
										aria-label="Menu lainnya Admin KPPN"
										className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-1"
									>
										{moreItems.map((item) => (
											<NavigationLink
												currentPath={currentPath}
												item={item}
												key={item.href}
												onClick={() => setIsMoreOpen(false)}
											/>
										))}
									</nav>
									<div className="shrink-0 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
										<SignOutAction className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-surface-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface transition">
											Keluar dari Sesi Admin
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
