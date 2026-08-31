import { LockKeyhole } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type PolicyLockAlertProps = Omit<
	ComponentProps<"aside">,
	"children" | "title"
> & {
	reason: string;
	lockedFields?: readonly string[];
	title?: string;
	description?: string;
};

export function PolicyLockAlert({
	reason,
	lockedFields = [],
	title = "Diatur oleh policy KPPN",
	description = "Field ini dikunci dan tidak dapat diubah oleh Operator Satker.",
	className,
	...props
}: PolicyLockAlertProps) {
	return (
		<aside
			{...props}
			className={twMerge(
				"rounded-lg border border-primary/20 bg-primary/10 p-5 sm:p-6",
				className,
			)}
			data-slot="policy-lock-alert"
			role="note"
		>
			<div className="flex items-start gap-3">
				<LockKeyhole
					aria-hidden="true"
					className="mt-0.5 size-5 shrink-0 text-primary"
				/>
				<div className="min-w-0 space-y-2">
					<h2 className="text-h3">{title}</h2>
					<p className="text-body-small text-muted-foreground">{description}</p>
					<p className="text-body-small">
						<span className="font-semibold">Alasan:</span> {reason}
					</p>
					{lockedFields.length > 0 ? (
						<div>
							<p className="text-label">Field terkunci</p>
							<ul className="mt-1 list-disc space-y-1 pl-5 text-body-small text-muted-foreground">
								{lockedFields.map((field, index) => (
									<li key={`${index}-${field}`}>{field}</li>
								))}
							</ul>
						</div>
					) : null}
				</div>
			</div>
		</aside>
	);
}
