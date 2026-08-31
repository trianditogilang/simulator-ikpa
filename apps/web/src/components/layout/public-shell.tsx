import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { PublicHeader } from "./public-header";

export type PublicShellProps = Omit<ComponentProps<"div">, "children"> & {
	children: ReactNode;
	header?: ReactNode;
	contentClassName?: string;
	productName?: string;
	contactHref?: string;
	contactLabel?: string;
};

export function PublicShell({
	children,
	header,
	contentClassName,
	productName,
	contactHref,
	contactLabel,
	className,
	...props
}: PublicShellProps) {
	return (
		<div
			{...props}
			className={twMerge("flex min-h-dvh flex-col bg-background", className)}
			data-slot="public-shell"
		>
			{header ?? (
				<PublicHeader
					productName={productName}
					contactHref={contactHref}
					contactLabel={contactLabel}
				/>
			)}
			<main
				className={twMerge(
					"mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center px-4 py-4 sm:px-6 sm:py-6 lg:px-8",
					contentClassName,
				)}
			>
				{children}
			</main>
			<footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
				<p>
					Simulator Penilaian IKPA v1.0.0 &copy; 2026. Alat bantu simulasi dan
					mitigasi risiko internal Satuan Kerja.
				</p>
			</footer>
		</div>
	);
}
