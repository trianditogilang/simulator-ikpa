import {
	SignIn as ClerkSignIn,
	SignUp as ClerkSignUp,
	useAuth,
	useUser,
} from "@clerk/tanstack-react-start";
import { ArrowRight, LogOut, UserPlus, LogIn } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { SignOutAction } from "@/components/auth/sign-out-action";

export type AuthCardProps = ComponentProps<"div"> & {
	onSuccessRedirect?: string;
};

function isSafeRedirectIntent(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length <= 512 &&
		value.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\") &&
		!/[\r\n]/.test(value)
	);
}

function ClerkAuthCard({
	safeRedirectIntent,
}: {
	safeRedirectIntent?: string;
}) {
	const { isSignedIn, isLoaded } = useAuth();
	const { user } = useUser();
	const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");

	if (isLoaded && isSignedIn) {
		const displayName =
			user?.fullName ||
			user?.firstName ||
			user?.primaryEmailAddress?.emailAddress ||
			"Pengguna";
		const email = user?.primaryEmailAddress?.emailAddress;

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

	return (
		<div className="w-full max-w-[400px] space-y-3">
			{/* Mode Switcher */}
			<div className="flex rounded-xl border border-border bg-surface p-1 text-xs font-semibold">
				<button
					type="button"
					onClick={() => setAuthMode("sign-in")}
					className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${
						authMode === "sign-in"
							? "bg-background text-primary shadow-xs"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					<LogIn className="size-3.5" />
					<span>Masuk</span>
				</button>
				<button
					type="button"
					onClick={() => setAuthMode("sign-up")}
					className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${
						authMode === "sign-up"
							? "bg-background text-primary shadow-xs"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					<UserPlus className="size-3.5" />
					<span>Daftar Akun Baru</span>
				</button>
			</div>

			{authMode === "sign-in" ? (
				<ClerkSignIn
					routing="hash"
					signUpUrl="/sign-up"
					forceRedirectUrl={safeRedirectIntent}
					fallbackRedirectUrl="/sign-in"
					signUpFallbackRedirectUrl="/sign-in"
					appearance={{
						elements: {
							rootBox: "mx-auto w-full min-w-0 max-w-full",
							cardBox: "mx-auto !w-full !min-w-0 !max-w-[400px]",
							card: "w-full min-w-0 max-w-full border-0 bg-transparent p-0 shadow-none",
						},
					}}
				/>
			) : (
				<ClerkSignUp
					routing="hash"
					signInUrl="/sign-in"
					forceRedirectUrl={safeRedirectIntent}
					fallbackRedirectUrl="/sign-in"
					signInFallbackRedirectUrl="/sign-in"
					appearance={{
						elements: {
							rootBox: "mx-auto w-full min-w-0 max-w-full",
							cardBox: "mx-auto !w-full !min-w-0 !max-w-[400px]",
							card: "w-full min-w-0 max-w-full border-0 bg-transparent p-0 shadow-none",
						},
					}}
				/>
			)}
		</div>
	);
}

export function AuthCard({
	onSuccessRedirect,
	className,
	...props
}: AuthCardProps) {
	const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();
	const safeRedirectIntent = isSafeRedirectIntent(onSuccessRedirect)
		? onSuccessRedirect
		: undefined;

	return (
		<div
			{...props}
			className={twMerge(
				"relative flex min-w-0 w-full justify-center",
				className,
			)}
			data-slot="auth-card"
		>
			{publishableKey ? (
				<ClerkAuthCard safeRedirectIntent={safeRedirectIntent} />
			) : (
				<div
					className="rounded-xl border border-warning/30 bg-warning-surface p-4 text-sm text-foreground"
					data-auth-provider="missing"
				>
					<h2 className="font-semibold">Login belum dikonfigurasi</h2>
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
						Isi <code>VITE_CLERK_PUBLISHABLE_KEY</code> untuk menampilkan form
						login Clerk.
					</p>
				</div>
			)}
		</div>
	);
}
