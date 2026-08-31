import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type PublicHeaderProps = Omit<ComponentProps<"header">, "children"> & {
	productName?: string;
	loginHref?: string;
};

export function PublicHeader({
	productName = "Simulator IKPA",
	loginHref = "/sign-in",
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
					className="inline-flex min-h-10 items-center gap-2 rounded-md text-foreground"
					href="/"
				>
					<span
						aria-hidden="true"
						className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-label text-primary-foreground"
					>
						SI
					</span>
					<span className="text-label sm:text-body">{productName}</span>
				</a>
				<a
					className="inline-flex min-h-10 items-center justify-center rounded-md border border-primary px-4 py-2 text-label text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
					href={loginHref}
				>
					Masuk
				</a>
			</div>
		</header>
	);
}
