import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { AdminNavigation } from "./admin-navigation";

export type AdminShellProps = Omit<ComponentProps<"div">, "children"> & {
	children: ReactNode;
	currentPath: string;
	header?: ReactNode;
};

export function AdminShell({
	children,
	currentPath,
	header,
	className,
	...props
}: AdminShellProps) {
	return (
		<div
			{...props}
			className={twMerge(
				"grid min-h-dvh bg-background md:grid-cols-[16rem_minmax(0,1fr)]",
				className,
			)}
			data-access-mode="admin_kppn"
			data-slot="admin-shell"
		>
			<AdminNavigation currentPath={currentPath} />
			<div className="min-w-0">
				{header}
				<main className="min-h-[calc(100dvh-4rem)] px-4 pb-24 pt-6 sm:px-6 md:pb-8 lg:px-8">
					<div className="mx-auto w-full max-w-[1440px]">{children}</div>
				</main>
			</div>
		</div>
	);
}
