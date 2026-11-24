import { Link } from "@tanstack/react-router";
import {
	Building2,
	CheckCircle2,
	Clock,
	LoaderCircle,
	LogOut,
	MessageCircle,
	ShieldAlert,
} from "lucide-react";
import { type ComponentProps, type FormEvent, useState } from "react";
import { twMerge } from "tailwind-merge";
import { SignOutAction } from "@/components/auth/sign-out-action";
import { KODE_SATKER_PATTERN, KODE_SATKER_RULE } from "@/server/auth-session";
import {
	type MyAccessRequest,
	requestSatkerAccess,
} from "@/services/settings-service";

const defaultContactHref =
	"https://wa.me/6281234567890?text=Halo%20Admin%20KPPN%2C%20saya%20ingin%20meminta%20akses%20Simulator%20IKPA";

export type AccessPendingProps = Omit<ComponentProps<"section">, "children"> & {
	email?: string;
	contactHref?: string;
	/** The user's own access request, read by the route loader. */
	request?: MyAccessRequest;
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
	email,
	contactHref = defaultContactHref,
	request = null,
	className,
	...props
}: AccessPendingProps) {
	const maskedEmail = email ? maskEmail(email) : "Identitas terverifikasi";
	const [activeTab, setActiveTab] = useState<"register" | "info">("register");
	const [current, setCurrent] = useState<MyAccessRequest>(request);
	const isWaiting = current?.status === "pending";
	const isRejected = current?.status === "rejected";

	// Form states
	const [kodeSatker, setKodeSatker] = useState(current?.kodeSatker ?? "");
	const [namaSatker, setNamaSatker] = useState(current?.satkerName ?? "");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const handleRegister = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);

		const cleanKode = kodeSatker.trim();
		const cleanNama = namaSatker.trim();

		if (!KODE_SATKER_PATTERN.test(cleanKode)) {
			setError(KODE_SATKER_RULE);
			return;
		}

		if (cleanNama.length < 3) {
			setError("Nama Satker minimal 3 karakter.");
			return;
		}

		setIsSubmitting(true);
		try {
			await requestSatkerAccess({ kodeSatker: cleanKode, name: cleanNama });
			setSuccess(true);
			setCurrent({
				kodeSatker: cleanKode.toUpperCase(),
				satkerName: cleanNama,
				status: "pending",
			});
		} catch (err: unknown) {
			const msg =
				err instanceof Error
					? err.message
					: "Gagal mengirim permintaan akses. Silakan coba lagi.";
			setError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section
			{...props}
			aria-labelledby="access-pending-heading"
			className={twMerge("w-full max-w-lg self-center", className)}
			data-slot="access-pending"
		>
			<div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8 space-y-6">
				{/* Top Header */}
				<div className="text-center">
					<div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<Building2 aria-hidden="true" className="size-6" />
					</div>
					<p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
						Onboarding Satuan Kerja
					</p>
					<h1
						className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
						id="access-pending-heading"
					>
						{activeTab === "info"
							? "Akses Belum Diberikan"
							: isWaiting
								? "Menunggu Persetujuan Admin KPPN"
								: "Ajukan Akses Satuan Kerja"}
					</h1>
					<p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
						{activeTab === "info"
							? "Email Anda belum dipetakan ke lingkup Satker atau KPPN manapun."
							: isWaiting
								? "Admin KPPN akan memeriksa permintaan Anda. Anda akan menerima email setelah akses disetujui."
								: "Isi identitas satuan kerja Anda. Akses Operator Satker aktif setelah disetujui Admin KPPN."}
					</p>
				</div>

				{/* Tab Selector */}
				<div className="flex rounded-xl border border-border bg-surface p-1 text-xs font-semibold">
					<button
						type="button"
						onClick={() => setActiveTab("register")}
						className={`flex-1 rounded-lg py-2 transition ${
							activeTab === "register"
								? "bg-background text-primary shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						{isWaiting ? "Status Permintaan" : "Ajukan Akses Satker"}
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("info")}
						className={`flex-1 rounded-lg py-2 transition ${
							activeTab === "info"
								? "bg-background text-primary shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Informasi &amp; Kontak Admin
					</button>
				</div>

				{/* Account identity badge */}
				<div className="flex items-center justify-between rounded-xl border border-border bg-surface/60 p-3.5 text-xs">
					<div>
						<span className="text-[11px] font-medium text-muted-foreground">
							Akun Terverifikasi:
						</span>
						<p className="font-semibold text-foreground break-all">
							{email || maskedEmail}
						</p>
					</div>
					<span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
						Operator Baru
					</span>
				</div>

				{/* TAB 1a: REQUEST WAITING FOR AN ADMIN DECISION */}
				{activeTab === "register" && isWaiting && current && (
					<div className="space-y-3">
						{success && (
							<output className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
								<CheckCircle2 className="size-4 shrink-0" />
								<p className="font-semibold">Permintaan akses terkirim.</p>
							</output>
						)}
						<div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface/60 p-4 text-xs">
							<Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
							<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
								<dt className="text-muted-foreground">Kode Satker</dt>
								<dd className="font-semibold text-foreground">{current.kodeSatker}</dd>
								<dt className="text-muted-foreground">Nama Satker</dt>
								<dd className="font-semibold text-foreground">{current.satkerName}</dd>
							</dl>
						</div>
						<p className="text-[11px] leading-relaxed text-muted-foreground">
							Data salah? Hubungi Admin KPPN lewat tab Informasi &amp; Kontak Admin.
						</p>
					</div>
				)}

				{/* TAB 1b: REQUEST FORM (first request, or again after a rejection) */}
				{activeTab === "register" && !isWaiting && (
					<form onSubmit={handleRegister} className="space-y-4">
						{error && (
							<div
								role="alert"
								className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
							>
								<ShieldAlert className="mt-0.5 size-4 shrink-0" />
								<p>{error}</p>
							</div>
						)}

						{isRejected && (
							<div
								role="alert"
								className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-surface p-3 text-xs text-foreground"
							>
								<ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
								<p>
									Permintaan sebelumnya ditolak Admin KPPN. Periksa kode dan nama
									satker, lalu ajukan ulang atau hubungi Admin KPPN.
								</p>
							</div>
						)}

						<div className="space-y-1.5">
							<label
								htmlFor="onboarding-kode"
								className="block text-xs font-semibold text-foreground"
							>
								Kode Satker (6 Digit)
							</label>
							<input
								id="onboarding-kode"
								type="text"
								required
								inputMode="numeric"
								maxLength={6}
								placeholder="Contoh: 411782"
								value={kodeSatker}
								onChange={(e) => setKodeSatker(e.target.value)}
								disabled={isSubmitting || success}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							/>
							<p className="text-[11px] text-muted-foreground">
								Masukkan kode satuan kerja 6 digit resmi dari DIPA.
							</p>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="onboarding-nama"
								className="block text-xs font-semibold text-foreground"
							>
								Nama Satuan Kerja
							</label>
							<input
								id="onboarding-nama"
								type="text"
								required
								maxLength={200}
								placeholder="Contoh: KPP Pratama Malang Selatan"
								value={namaSatker}
								onChange={(e) => setNamaSatker(e.target.value)}
								disabled={isSubmitting || success}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<button
							type="submit"
							disabled={isSubmitting || success}
							className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
						>
							{isSubmitting ? (
								<>
									<LoaderCircle className="size-4 animate-spin" />
									<span>Mengirim permintaan...</span>
								</>
							) : (
								<span>Ajukan Akses</span>
							)}
						</button>
					</form>
				)}

				{/* TAB 2: INFO & CONTACT */}
				{activeTab === "info" && (
					<div className="space-y-4">
						<div className="rounded-xl border border-warning/30 bg-warning-surface p-4">
							<div className="flex items-start gap-2.5">
								<ShieldAlert
									aria-hidden="true"
									className="mt-0.5 size-5 shrink-0 text-warning"
								/>
								<div>
									<h2 className="text-sm font-semibold text-foreground">
										Petunjuk Akses Melalui Admin KPPN
									</h2>
									<ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
										<li>
											Hubungi Admin KPPN yang menangani satuan kerja Anda jika
											satker Anda sudah didaftarkan sebelumnya.
										</li>
										<li>
											Sampaikan email kedinasan yang digunakan untuk login.
										</li>
										<li>Ulangi login setelah mapping akses diaktifkan.</li>
									</ol>
								</div>
							</div>
						</div>

						<a
							className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							href={contactHref}
							rel="noopener noreferrer"
							target="_blank"
						>
							<MessageCircle aria-hidden="true" className="size-4" />
							<span>Hubungi Admin KPPN via WhatsApp</span>
						</a>
					</div>
				)}

				{/* Bottom Actions */}
				<div className="border-t border-border pt-4 flex items-center justify-between gap-3 text-xs">
					<Link className="text-primary hover:underline" to="/">
						Kembali ke Beranda
					</Link>

					<SignOutAction className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
						<LogOut className="size-3.5" />
						<span>Keluar dari Sesi</span>
					</SignOutAction>
				</div>
			</div>
		</section>
	);
}
