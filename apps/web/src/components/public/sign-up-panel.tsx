import { SignUp as ClerkSignUp } from "@clerk/tanstack-react-start";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { twMerge } from "tailwind-merge";

export type SignUpPanelProps = ComponentProps<"section"> & {
	redirectIntent?: string;
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

export function SignUpPanel({
	redirectIntent,
	className,
	...props
}: SignUpPanelProps) {
	const safeRedirectIntent = isSafeRedirectIntent(redirectIntent)
		? redirectIntent
		: undefined;

	return (
		<section
			{...props}
			className={twMerge("w-full max-w-xl self-center space-y-5", className)}
			data-auth-provider="clerk"
			data-slot="sign-up-panel"
		>
			<Link
				to="/"
				className="inline-flex min-h-10 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				<ArrowLeft aria-hidden="true" className="size-4" />
				<span>Kembali ke Beranda</span>
			</Link>

			<div className="space-y-5 rounded-2xl border border-border bg-background p-3 shadow-sm sm:p-5">
				<div className="px-3 pt-2 sm:px-5">
					<p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
						Simulator IKPA
					</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
						Daftar Akun Baru
					</h1>
					<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
						Buat akun baru untuk mulai menggunakan simulator IKPA. Anda dapat
						mendaftarkan satuan kerja Anda setelah akun dibuat.
					</p>
				</div>
				<ClerkSignUp
					routing="hash"
					signInUrl="/sign-in"
					forceRedirectUrl={safeRedirectIntent}
					fallbackRedirectUrl="/sign-in"
					signInFallbackRedirectUrl="/sign-in"
				/>
			</div>
		</section>
	);
}
