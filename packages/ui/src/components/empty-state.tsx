import { FolderOpen } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type EmptyStateProps = Omit<
	ComponentProps<"section">,
	"children" | "title"
> & {
	domain: string;
	description: string;
	actionLabel: string;
	onAction: () => void;
	secondaryActionLabel?: string;
	onSecondaryAction?: () => void;
	title?: string;
};

export function EmptyState({
	domain,
	description,
	actionLabel,
	onAction,
	secondaryActionLabel,
	onSecondaryAction,
	title = "Belum ada data",
	className,
	...props
}: EmptyStateProps) {
	return (
		<section
			{...props}
			className={twMerge(
				"flex w-full flex-col items-center rounded-lg border border-dashed border-border bg-surface p-8 text-center sm:p-10",
				className,
			)}
			data-slot="empty-state"
		>
			<FolderOpen
				aria-hidden="true"
				className="size-10 text-muted-foreground"
			/>
			<p className="mt-4 text-label text-muted-foreground">{domain}</p>
			<h2 className="mt-1 text-h2">{title}</h2>
			<p className="mt-2 max-w-xl text-body-small text-muted-foreground">
				{description}
			</p>
			<div className="mt-6 flex flex-wrap justify-center gap-3">
				<button
					className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-label text-primary-foreground transition-colors hover:bg-primary-hover"
					onClick={onAction}
					type="button"
				>
					{actionLabel}
				</button>
				{secondaryActionLabel && onSecondaryAction ? (
					<button
						className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-label text-foreground transition-colors hover:bg-surface-muted"
						onClick={onSecondaryAction}
						type="button"
					>
						{secondaryActionLabel}
					</button>
				) : null}
			</div>
		</section>
	);
}
