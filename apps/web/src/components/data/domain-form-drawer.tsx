import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface DomainFormDrawerProps extends ComponentProps<"div"> {
	isOpen: boolean;
	title: string;
	description?: string;
	children: ReactNode;
	onClose: () => void;
	onSubmit: () => void;
	isSubmitting?: boolean;
}

export function DomainFormDrawer({
	isOpen,
	title,
	description,
	children,
	onClose,
	onSubmit,
	isSubmitting,
	className,
	...props
}: DomainFormDrawerProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
			<div
				{...props}
				className={twMerge(
					"relative w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl",
					className,
				)}
				data-slot="domain-form-drawer"
			>
				<div className="flex items-center justify-between border-b border-border/80 pb-3">
					<div>
						<h3 className="text-base font-bold text-foreground">{title}</h3>
						{description && (
							<p className="mt-0.5 text-xs text-muted-foreground">
								{description}
							</p>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="size-7 rounded-lg border border-border text-xs text-muted-foreground hover:bg-surface-muted"
					>
						✕
					</button>
				</div>

				<div className="py-4 text-xs">{children}</div>

				<div className="flex items-center justify-end gap-2 border-t border-border/80 pt-3">
					<button
						type="button"
						onClick={onClose}
						disabled={isSubmitting}
						className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
					>
						Batal
					</button>
					<button
						type="button"
						onClick={onSubmit}
						disabled={isSubmitting}
						className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover disabled:opacity-50"
					>
						{isSubmitting ? "Menyimpan..." : "Simpan Data"}
					</button>
				</div>
			</div>
		</div>
	);
}
