import { CircleAlert, RotateCcw } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

const safeRequestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function getSafeRequestId(
	requestId: string | null | undefined,
): string | undefined {
	const normalizedRequestId = requestId?.trim();

	return normalizedRequestId && safeRequestIdPattern.test(normalizedRequestId)
		? normalizedRequestId
		: undefined;
}

export type ErrorStateProps = Omit<
	ComponentProps<"section">,
	"children" | "title"
> & {
	title?: string;
	description?: string;
	requestId?: string | null;
	onRetry: () => void;
	retryLabel?: string;
};

export function ErrorState({
	title = "Data tidak dapat dimuat",
	description = "Terjadi kendala saat mengambil data. Coba lagi atau hubungi administrator jika masalah berlanjut.",
	requestId,
	onRetry,
	retryLabel = "Coba lagi",
	className,
	...props
}: ErrorStateProps) {
	const safeRequestId = getSafeRequestId(requestId);

	return (
		<section
			{...props}
			aria-live="assertive"
			className={twMerge(
				"rounded-lg border border-danger/30 bg-danger-surface p-5 sm:p-6",
				className,
			)}
			data-slot="error-state"
			role="alert"
		>
			<div className="flex items-start gap-3">
				<CircleAlert
					aria-hidden="true"
					className="mt-0.5 size-5 shrink-0 text-danger"
				/>
				<div className="min-w-0 space-y-2">
					<h2 className="text-h3">{title}</h2>
					<p className="text-body-small text-muted-foreground">{description}</p>
					<p className="text-body-small text-muted-foreground">
						<span className="font-semibold text-foreground">Request ID:</span>{" "}
						<code>{safeRequestId ?? "Tidak tersedia"}</code>
					</p>
					<button
						className="mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-label text-primary-foreground transition-colors hover:bg-primary-hover"
						onClick={onRetry}
						type="button"
					>
						<RotateCcw aria-hidden="true" className="size-4" />
						{retryLabel}
					</button>
				</div>
			</div>
		</section>
	);
}
