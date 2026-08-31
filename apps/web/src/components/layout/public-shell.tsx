import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { PublicHeader } from "./public-header";

export type PublicShellProps = Omit<ComponentProps<"div">, "children"> & {
	children: ReactNode;
	header?: ReactNode;
	contentClassName?: string;
	productName?: string;
	loginHref?: string;
};

export function PublicShell({
	children,
	header,
	contentClassName,
	productName,
	loginHref,
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
				<PublicHeader productName={productName} loginHref={loginHref} />
			)}
			<main
				className={twMerge(
					"mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8",
					contentClassName,
				)}
			>
				{children}
			</main>
		</div>
	);
}
