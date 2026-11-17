import { useRouteContext } from "@tanstack/react-router";
import { ArrowRight, LogOut } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { SignOutAction } from "@/components/auth/sign-out-action";
import { AuthForm } from "./auth-form";

export type AuthCardProps = ComponentProps<"div"> & {
	onSuccessRedirect?: string;
};

function SignedInCard({
	name,
	email,
}: {
	name: string | null;
	email: string | null;
}) {
	const displayName = name || email || "Pengguna";

	return (
		<div
			className="w-full max-w-[400px] rounded-2xl border border-border bg-background p-6 shadow-sm space-y-5"
			data-slot="authenticated-card"
		>
			<div className="flex items-center gap-3">
				<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
					{displayName.charAt(0).toUpperCase()}
				</div>
				<div className="min-w-0 flex-1">
					<div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
						<span className="size-1.5 rounded-full bg-success animate-pulse" />
						<span>Sesi Aktif</span>
					</div>
					<h3 className="mt-1 truncate text-sm font-semibold text-foreground">
						{displayName}
					</h3>
					{email && (
						<p className="truncate text-xs text-muted-foreground">{email}</p>
					)}
				</div>
			</div>

			<p className="text-xs leading-relaxed text-muted-foreground">
				Anda sudah masuk ke sistem Simulator IKPA. Lanjutkan ke modul aplikasi
				sesuai hak akses Anda atau keluar jika ingin berganti akun.
			</p>

			<div className="space-y-2 pt-1">
				<a
					href="/sign-in"
					className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					<span>Buka Dashboard</span>
					<ArrowRight className="size-4" />
				</a>

				<SignOutAction
					redirectUrl="/"
					className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					<LogOut className="size-3.5" />
					<span>Keluar dari Sesi</span>
				</SignOutAction>
			</div>
		</div>
	);
}

export function AuthCard({
	onSuccessRedirect,
	className,
	...props
}: AuthCardProps) {
	const { auth } = useRouteContext({ from: "__root__" });

	return (
		<div
			{...props}
			className={twMerge(
				"relative flex min-w-0 w-full justify-center",
				className,
			)}
			data-slot="auth-card"
		>
			{auth.isAuthenticated ? (
				<SignedInCard name={auth.name} email={auth.email} />
			) : (
				<div className="w-full max-w-[400px] rounded-2xl border border-border bg-background p-6 shadow-sm">
					<AuthForm redirectTo={onSuccessRedirect} />
				</div>
			)}
		</div>
	);
}
