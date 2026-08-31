import { Info } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type SimulationDisclaimerProps = Omit<
	ComponentProps<"aside">,
	"children"
> & {
	message?: string;
};

export function SimulationDisclaimer({
	message = "Simulasi internal, bukan nilai resmi OMSPAN/KPPN.",
	className,
	...props
}: SimulationDisclaimerProps) {
	return (
		<aside
			{...props}
			className={twMerge(
				"flex items-start gap-3 rounded-md border border-info/30 bg-info-surface px-4 py-3 text-info",
				className,
			)}
			data-slot="simulation-disclaimer"
			role="note"
		>
			<Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
			<p className="text-body-small">{message}</p>
		</aside>
	);
}
