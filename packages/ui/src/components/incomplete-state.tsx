import { TriangleAlert } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type IncompleteStateProps = Omit<
	ComponentProps<"section">,
	"children" | "title"
> & {
	domain: string;
	items: readonly string[];
	description: string;
	actionLabel: string;
	onAction: () => void;
	title?: string;
};

export function IncompleteState({
	domain,
	items,
	description,
	actionLabel,
	onAction,
	title = "Nilai masih berupa estimasi",
	className,
	...props
}: IncompleteStateProps) {
	return (
		<section
			{...props}
			className={twMerge(
				"rounded-lg border border-warning/30 bg-warning-surface p-5 sm:p-6",
				className,
			)}
			data-slot="incomplete-state"
		>
			<div className="flex items-start gap-3">
				<TriangleAlert
					aria-hidden="true"
					className="mt-0.5 size-5 shrink-0 text-warning"
				/>
				<div className="min-w-0 flex-1">
					<p className="text-label text-warning">{domain}</p>
					<h2 className="mt-1 text-h3">{title}</h2>
					<p className="mt-2 text-body-small text-muted-foreground">
						{description}
					</p>
					{items.length > 0 ? (
						<div className="mt-4">
							<p className="text-label">Data yang masih diperlukan</p>
							<ul className="mt-2 list-disc space-y-1 pl-5 text-body-small text-muted-foreground">
								{items.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>
					) : null}
					<button
						className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-label text-primary-foreground transition-colors hover:bg-primary-hover"
						onClick={onAction}
						type="button"
					>
						{actionLabel}
					</button>
				</div>
			</div>
		</section>
	);
}
