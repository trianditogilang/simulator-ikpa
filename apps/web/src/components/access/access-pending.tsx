import {
	CheckCircle2,
	LockKeyhole,
	LogOut,
	MessageCircle,
	ShieldAlert,
} from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { twMerge } from "tailwind-merge";

const defaultContactHref =
	"https://wa.me/6281234567890?text=Halo%20Admin%20KPPN%2C%20saya%20ingin%20meminta%20akses%20Simulator%20IKPA";

export type AccessPendingProps = Omit<ComponentProps<"section">, "children"> & {
	email?: string;
	contactHref?: string;
};

export function maskEmail(email: string) {
	const [localPart, domain] = email.trim().split("@");

	if (!localPart || !domain) {
		return "Identitas terverifikasi";
	}

	const visibleCharacter = localPart.slice(0, 1);
	const maskedLength = Math.max(3, Math.min(5, localPart.length));

	return `${visibleCharacter}${"•".repeat(maskedLength)}@${domain}`;
}

export function AccessPending({
	email = "user@contoh.go.id",
	contactHref = defaultContactHref,
	className,
	...props
}: AccessPendingProps) {
	const [isSignedOut, setIsSignedOut] = useState(false);
	const maskedEmail = maskEmail(email);

	return (
		<section
			{...props}
			aria-labelledby="access-pending-heading"
			className={twMerge("w-full max-w-lg self-center", className)}
			data-slot="access-pending"
		>
			<div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
				{isSignedOut ? (
					<div aria-live="polite" className="text-center">
						<div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-success-surface text-success">
							<CheckCircle2 aria-hidden="true" className="size-6" />
						</div>
						<h1
							className="mt-5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
							id="access-pending-heading"
						>
							Anda telah keluar
						</h1>
						<p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
							Sesi dummy telah diakhiri. Masuk kembali untuk mengulangi simulasi
							alur akses.
						</p>
						<Link
							className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
							search={{ next: "/access-pending" }}
							to="/sign-in"
						>
							Kembali ke halaman login
						</Link>
					</div>
				) : (
					<>
						<div className="text-center">
							<div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
								<LockKeyhole aria-hidden="true" className="size-6" />
							</div>
							<p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
								Status akses
							</p>
							<h1
								className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
								id="access-pending-heading"
							>
								Akses belum diberikan
							</h1>
							<p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
								Anda berhasil masuk, tetapi email ini belum memiliki mapping
								sebagai Operator Satker atau Admin KPPN.
							</p>
						</div>

						<div className="mt-6 rounded-xl border border-border bg-surface p-4">
							<p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
								Identitas akun
							</p>
							<p className="mt-2 break-all text-sm font-semibold text-foreground">
								{maskedEmail}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Identitas ditampilkan secara tersamarkan untuk menjaga privasi.
							</p>
						</div>

						<div className="mt-4 rounded-xl border border-warning/30 bg-warning-surface p-4">
							<div className="flex items-start gap-2.5">
								<ShieldAlert
									aria-hidden="true"
									className="mt-0.5 size-5 shrink-0 text-warning"
								/>
								<div>
									<h2 className="text-sm font-semibold text-foreground">
										Langkah berikutnya
									</h2>
									<ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
										<li>
											Hubungi Admin KPPN yang menangani satuan kerja Anda.
										</li>
										<li>
											Sampaikan email kedinasan yang digunakan untuk login.
										</li>
										<li>Ulangi login setelah mapping akses diaktifkan.</li>
									</ol>
								</div>
							</div>
						</div>

						<div className="mt-6 grid gap-3 sm:grid-cols-2">
							<a
								className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
								href={contactHref}
								rel="noopener noreferrer"
								target="_blank"
							>
								<MessageCircle aria-hidden="true" className="size-4" />
								Hubungi Admin KPPN
							</a>
							<button
								className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
								onClick={() => setIsSignedOut(true)}
								type="button"
							>
								<LogOut aria-hidden="true" className="size-4" />
								Keluar
							</button>
						</div>

						<div className="mt-5 border-t border-border pt-4 text-center">
							<Link
								className="text-xs font-medium text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								search={{ next: "/access-pending" }}
								to="/sign-in"
							>
								Kembali ke halaman login
							</Link>
						</div>
					</>
				)}
			</div>
		</section>
	);
}
