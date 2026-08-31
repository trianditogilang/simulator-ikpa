import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type PublicHeaderProps = Omit<ComponentProps<"header">, "children"> & {
	productName?: string;
	contactHref?: string;
	contactLabel?: string;
};

export function PublicHeader({
	productName = "Simulator IKPA",
	contactHref = "https://wa.me/6281234567890?text=Halo%20Admin%20KPPN%2C%20saya%20ingin%20konsultasi%20terkait%20Simulator%20IKPA",
	contactLabel = "Kontak",
	className,
	...props
}: PublicHeaderProps) {
	return (
		<header
			{...props}
			className={twMerge("border-b border-border bg-background", className)}
			data-slot="public-header"
		>
			<div className="mx-auto flex min-h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
				<a
					aria-label={`${productName} - Beranda`}
					className="inline-flex min-h-10 items-center gap-2.5 rounded-md text-foreground"
					href="/"
				>
					<span
						aria-hidden="true"
						className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-xs"
					>
						SI
					</span>
					<span className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
						{productName}
					</span>
				</a>
				<a
					className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:border-primary/40 hover:bg-surface-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
					href={contactHref}
					target="_blank"
					rel="noopener noreferrer"
				>
					{contactLabel}
				</a>
			</div>
		</header>
	);
}
