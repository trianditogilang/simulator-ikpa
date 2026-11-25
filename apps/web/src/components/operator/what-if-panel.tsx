import { Maximize2, Minimize2 } from "lucide-react";
import { useState, type ReactNode } from "react";

interface WhatIfPanelProps {
	storageKey: string;
	title: string;
	description: string;
	action?: ReactNode;
	children: ReactNode;
}

export function WhatIfPanel({
	storageKey,
	title,
	description,
	action,
	children,
}: WhatIfPanelProps) {
	const [expanded, setExpanded] = useState(() => {
		try {
			return window.localStorage.getItem(storageKey) === "open";
		} catch {
			return false;
		}
	});

	const toggle = () => {
		setExpanded((prev) => {
			const next = !prev;
			try {
				window.localStorage.setItem(storageKey, next ? "open" : "closed");
			} catch {
				// ignore storage errors
			}
			return next;
		});
	};

	return (
		<section
			aria-label={title}
			className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 sm:p-5 shadow-xs space-y-4"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<button
					type="button"
					onClick={toggle}
					aria-expanded={expanded}
					title={expanded ? "Minimize panel simulasi" : "Maximize panel simulasi"}
					className="flex min-w-0 flex-1 items-start gap-2 text-left"
				>
					<span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-amber-400" />
					<span className="min-w-0">
						<span className="block text-base font-bold text-foreground">
							{title}
						</span>
						<span className="mt-0.5 block text-xs text-muted-foreground">
							{description}
						</span>
					</span>
				</button>

				<span className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
					{action}
					<button
						type="button"
						onClick={toggle}
						aria-expanded={expanded}
						aria-label={expanded ? "Minimize panel simulasi" : "Maximize panel simulasi"}
						title={expanded ? "Minimize" : "Maximize"}
						className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl border border-amber-300/80 bg-background px-2.5 text-amber-900 transition hover:bg-amber-100/70"
					>
						{expanded ? (
							<Minimize2 className="size-3.5" />
						) : (
							<Maximize2 className="size-3.5" />
						)}
					</button>
				</span>
			</div>

			{expanded && children}
		</section>
	);
}
