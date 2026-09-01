import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { AuthCard } from "./auth-card";

export type LandingContentProps = ComponentProps<"div">;

export function LandingContent({ className, ...props }: LandingContentProps) {
	return (
		<div
			{...props}
			className={twMerge("flex flex-1 flex-col justify-center", className)}
			data-slot="landing-content"
		>
			{/* HERO & AUTH SECTION (COMPACT FIT TO VIEWPORT) */}
			<section
				aria-labelledby="hero-heading"
				className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-surface to-background p-6 shadow-sm sm:p-8 lg:p-10"
			>
				{/* Subtle background aura */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/5 blur-2xl"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-info/5 blur-2xl"
				/>

				<div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
					{/* Left Column: Heading & Concise Description */}
					<div className="space-y-4 lg:col-span-7">
						<div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-0.5 text-xs font-semibold text-primary">
							<span>PER-5/ PB/ 2024</span>
						</div>

						<div className="space-y-3">
							<h1
								id="hero-heading"
								className="text-balance text-4xl font-[600] leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[48px]"
							>
								SIMULATOR PENILAIAN <br />
								<span className="bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
									IKPA SATKER
								</span>
							</h1>
							<p className="max-w-xl text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
								Kendalikan kinerja pelaksanaan anggaran lebih awal. Simulasikan
								nilai secara presisi, pantau risiko sebelum jatuh tempo, dan
								kelola tenggat penting IKPA satuan kerja Anda.
							</p>
						</div>

						<div className="pt-2">
							<p className="text-xs text-muted-foreground">
								*Hasil perhitungan hanya merupakan simulasi internal, silakan
								validasi kembali
							</p>
						</div>
					</div>

					{/* Right Column: Compact Sign In / Sign Up Area */}
					<div className="lg:col-span-5">
						<AuthCard />
					</div>
				</div>
			</section>
		</div>
	);
}
