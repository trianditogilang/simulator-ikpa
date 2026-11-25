import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { AuthForm } from "./auth-form";

export type SignInPanelProps = Omit<ComponentProps<"section">, "children"> & {
	redirectIntent?: string;
};

export function SignInPanel({
	redirectIntent,
	className,
	...props
}: SignInPanelProps) {
	return (
		<section
			{...props}
			className={twMerge("w-full max-w-xl self-center space-y-5", className)}
			data-slot="sign-in-panel"
		>
			<Link
				to="/"
				className="inline-flex min-h-10 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				<ArrowLeft aria-hidden="true" className="size-4" />
				<span>Kembali ke Beranda</span>
			</Link>

			<div className="space-y-5 rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
						Simulator IKPA
					</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
						Masuk ke Akun Anda
					</h1>
					<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
						Masuk dengan email dan kata sandi. Hak akses aplikasi ditentukan
						server berdasarkan mapping internal.
					</p>
				</div>
				<AuthForm initialMode="sign-in" redirectTo={redirectIntent} />
			</div>
		</section>
	);
}
