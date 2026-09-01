import { SignIn as ClerkSignIn } from "@clerk/tanstack-react-start";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

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
			className={twMerge("relative flex min-w-0 w-full justify-center", className)}
			data-slot="auth-card"
		>
			{publishableKey ? (
				<ClerkSignIn
					routing="hash"
					forceRedirectUrl={safeRedirectIntent}
					fallbackRedirectUrl="/operator/dashboard"
					appearance={{
						elements: {
							rootBox: "mx-auto w-full min-w-0 max-w-full",
							cardBox: "mx-auto !w-full !min-w-0 !max-w-[400px]",
							card: "w-full min-w-0 max-w-full border-0 bg-transparent p-0 shadow-none",
						},
					}}
				/>
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
