import { SignIn as ClerkSignIn } from "@clerk/tanstack-react-start";
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	HelpCircle,
	KeyRound,
	LoaderCircle,
	Scale,
	ShieldCheck,
	X,
} from "lucide-react";
import { useState, type ComponentProps, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { twMerge } from "tailwind-merge";
import {
	mockAuthPresets,
	mockPermissionMatrix,
	type AuthPresetUser,
} from "@/mocks/auth-presets";

type SignInStatus = "idle" | "loading" | "error" | "reset" | "mfa" | "success";

export type SignInPanelProps = Omit<ComponentProps<"section">, "children"> & {
	redirectIntent?: string;
};

function isSafeRedirectIntent(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length <= 512 &&
		value.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\") &&
		!/[\r\n]/.test(value)
	);
}

function determineDestination(
	email: string,
	selectedPreset: AuthPresetUser,
	redirectIntent?: string,
): { targetPath: string; roleLabel: string; name: string } {
	if (isSafeRedirectIntent(redirectIntent) && redirectIntent !== "/access-pending") {
		return {
			targetPath: redirectIntent,
			roleLabel: "Pengguna",
			name: email.split("@")[0] || "User",
		};
	}

	const lower = email.toLowerCase().trim();
	const matched = mockAuthPresets.find((p) => p.email.toLowerCase() === lower);
	if (matched) {
		return {
			targetPath: matched.targetPath,
			roleLabel: matched.roleLabel,
			name: matched.name,
		};
	}

	// Keyword-based fallback detection
	if (
		lower.includes("admin") ||
		lower.includes("kppn") ||
		lower.includes("pembina")
	) {
		return {
			targetPath: "/admin-kppn/dashboard",
			roleLabel: "Admin KPPN",
			name: "Admin KPPN (Custom)",
		};
	}

	if (
		lower.includes("satker") ||
		lower.includes("operator") ||
		lower.includes("polinema") ||
		lower.includes("btn") ||
		lower.includes("pn-") ||
		lower.includes("imigrasi")
	) {
		return {
			targetPath: "/operator/dashboard",
			roleLabel: "Operator Satker",
			name: "Operator Satker (Custom)",
		};
	}

	if (lower.includes("wilayah") || lower.includes("multi")) {
		return {
			targetPath: "/select-organization",
			roleLabel: "Operator Multi-Satker",
			name: "Koordinator Wilayah",
		};
	}

	// Default fallback if unknown
	return {
		targetPath: selectedPreset.targetPath,
		roleLabel: selectedPreset.roleLabel,
		name: selectedPreset.name,
	};
}

function DemoSignInPanel({
	redirectIntent,
	className,
	...props
}: SignInPanelProps) {
	const [selectedPreset, setSelectedPreset] = useState<AuthPresetUser>(
		mockAuthPresets[0], // Default: Admin KPPN
	);
	const [email, setEmail] = useState(mockAuthPresets[0].email);
	const [password, setPassword] = useState("password123");
	const [status, setStatus] = useState<SignInStatus>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isMatrixOpen, setIsMatrixOpen] = useState(false);

	const isBusy = status === "loading";

	const resolvedAuth = determineDestination(
		email,
		selectedPreset,
		redirectIntent,
	);

	const handleSelectPreset = (preset: AuthPresetUser) => {
		setSelectedPreset(preset);
		setEmail(preset.email);
		setPassword("password123");
		setStatus("idle");
		setErrorMessage(null);
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage(null);

		if (!email.includes("@") || !email.includes(".")) {
			setStatus("error");
			setErrorMessage("Masukkan email kedinasan yang valid.");
			return;
		}

		if (password.length < 8) {
			setStatus("error");
			setErrorMessage("Kata sandi minimal terdiri dari 8 karakter.");
			return;
		}

		setStatus("loading");
		await new Promise((resolve) => window.setTimeout(resolve, 450));
		document.cookie = `dev_session=${encodeURIComponent(
			`dev_user_${selectedPreset.role === "admin_kppn" ? "admin" : selectedPreset.role === "multi_satker" ? "multi" : selectedPreset.role === "pending" ? "unmapped" : "operator"}`,
		)}; Path=/; SameSite=Lax`;
		setStatus("success");
	};

	const resetToForm = () => {
		setStatus("idle");
		setErrorMessage(null);
	};

	return (
		<section
			{...props}
			className={twMerge("w-full max-w-xl self-center space-y-5", className)}
			data-slot="sign-in-panel"
		>
			<Link
				to="/"
				className="inline-flex min-h-10 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				<ArrowLeft aria-hidden="true" className="size-4" />
				<span>Kembali ke Beranda</span>
			</Link>

			<div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8 space-y-6">
				{/* Header */}
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start gap-3">
						<span
							aria-hidden="true"
							className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-xs"
						>
							SI
						</span>
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
								Simulator IKPA
							</p>
							<h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
								Masuk ke Akun Anda
							</h1>
						</div>
					</div>

					<button
						type="button"
						onClick={() => setIsMatrixOpen(true)}
						className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-surface-muted transition"
					>
						<HelpCircle className="size-3.5" />
						<span className="hidden sm:inline">Perbedaan Hak Akses</span>
					</button>
				</div>

				{/* Quick Role Selection Presets */}
				<div className="space-y-2 rounded-xl border border-border/80 bg-surface p-4 text-xs">
					<div className="flex items-center justify-between">
						<span className="font-semibold text-foreground">
							Uji Coba Hak Akses (Demo Preset):
						</span>
						<span className="text-[11px] text-muted-foreground">
							Pilih peran untuk login
						</span>
					</div>

					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{mockAuthPresets.map((preset) => {
							const isSelected = selectedPreset.id === preset.id;
							return (
								<button
									key={preset.id}
									type="button"
									onClick={() => handleSelectPreset(preset)}
									className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
										isSelected
											? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
											: "border-border/80 bg-background hover:border-primary/40 hover:bg-surface-muted"
									}`}
								>
									<div className="flex w-full items-center justify-between">
										<span className="font-semibold text-foreground truncate">
											{preset.roleLabel}
										</span>
										{isSelected && (
											<CheckCircle2 className="size-3.5 text-primary shrink-0" />
										)}
									</div>
									<span className="mt-1 text-[11px] text-muted-foreground truncate">
										{preset.scopeName}
									</span>
								</button>
							);
						})}
					</div>

					{/* Selected Preset Details Box */}
					<div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1.5">
						<div className="flex items-center justify-between">
							<span className="font-semibold text-foreground">
								Peran:{" "}
								<strong className="text-primary">
									{selectedPreset.roleLabel}
								</strong>{" "}
								({selectedPreset.name})
							</span>
							<span className="font-mono text-[11px] text-muted-foreground">
								Scope: {selectedPreset.scopeCode} — {selectedPreset.scopeName}
							</span>
						</div>
						<p className="text-muted-foreground leading-relaxed">
							{selectedPreset.description}
						</p>
						<div className="flex items-center gap-1.5 pt-1 text-[11px] text-primary font-medium">
							<span>Akan diarahkan ke:</span>
							<code className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-foreground">
								{resolvedAuth.targetPath}
							</code>
						</div>
					</div>
				</div>

				{/* Status Banners */}
				{status === "error" && errorMessage ? (
					<div
						aria-live="assertive"
						className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-danger text-xs"
						role="alert"
					>
						<AlertCircle
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0"
						/>
						<p>{errorMessage}</p>
					</div>
				) : null}

				{status === "reset" ? (
					<div
						aria-live="polite"
						className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info/10 p-3 text-info text-xs"
					>
						<KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
						<div>
							<p className="font-semibold">Pemulihan Kata Sandi</p>
							<p className="mt-0.5 text-muted-foreground">
								Gunakan kata sandi demo{" "}
								<code className="rounded bg-background px-1 font-semibold">
									password123
								</code>{" "}
								atau pilih preset akun di atas.
							</p>
						</div>
					</div>
				) : null}

				{status === "success" ? (
					<div
						aria-live="polite"
						className="rounded-xl border border-success/30 bg-success/10 p-4 space-y-3"
					>
						<div className="flex items-start gap-2.5 text-success">
							<CheckCircle2
								aria-hidden="true"
								className="mt-0.5 size-5 shrink-0"
							/>
							<div>
								<p className="text-sm font-semibold">Autentikasi Berhasil</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									Masuk sebagai <strong>{resolvedAuth.name}</strong> (
									{resolvedAuth.roleLabel}).
								</p>
							</div>
						</div>

						<div className="flex flex-col gap-2 sm:flex-row pt-1">
							<a
								className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
								href={resolvedAuth.targetPath}
							>
								<span>Buka Dashboard {resolvedAuth.roleLabel}</span>
								<ArrowRight className="size-3.5" />
							</a>
							<button
								className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
								onClick={() => setStatus("mfa")}
								type="button"
							>
								Verifikasi MFA
							</button>
						</div>
					</div>
				) : null}

				{status === "mfa" ? (
					<div
						aria-live="polite"
						className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3"
					>
						<div className="flex items-start gap-2.5">
							<ShieldCheck
								aria-hidden="true"
								className="mt-0.5 size-5 shrink-0 text-primary"
							/>
							<div>
								<p className="text-sm font-semibold text-foreground">
									Verifikasi Multi-Faktor (MFA Demo)
								</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									Kode OTP telah diverifikasi secara otomatis untuk sesi
									simulasi ini.
								</p>
							</div>
						</div>
						<a
							className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
							href={resolvedAuth.targetPath}
						>
							<span>Lanjutkan ke Dashboard {resolvedAuth.roleLabel}</span>
							<ArrowRight className="size-3.5" />
						</a>
					</div>
				) : null}

				{/* Sign In Form */}
				{status !== "success" && status !== "mfa" ? (
					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-1.5">
							<label
								className="block text-xs font-semibold text-foreground"
								htmlFor="sign-in-email"
							>
								Email Kedinasan
							</label>
							<input
								autoComplete="email"
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
								disabled={isBusy}
								id="sign-in-email"
								name="email"
								onChange={(event) => setEmail(event.target.value)}
								placeholder="nama@kemenkeu.go.id"
								required
								type="email"
								value={email}
							/>
						</div>

						<div className="space-y-1.5">
							<div className="flex items-center justify-between gap-3">
								<label
									className="block text-xs font-semibold text-foreground"
									htmlFor="sign-in-password"
								>
									Kata Sandi
								</label>
								<button
									className="text-xs font-medium text-primary hover:underline"
									disabled={isBusy}
									onClick={() => {
										setStatus("reset");
										setErrorMessage(null);
									}}
									type="button"
								>
									Lupa kata sandi?
								</button>
							</div>
							<input
								autoComplete="current-password"
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
								disabled={isBusy}
								id="sign-in-password"
								minLength={8}
								name="password"
								onChange={(event) => setPassword(event.target.value)}
								placeholder="Minimal 8 karakter"
								required
								type="password"
								value={password}
							/>
						</div>

						<button
							className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isBusy}
							type="submit"
						>
							{isBusy ? (
								<>
									<LoaderCircle
										aria-hidden="true"
										className="size-4 animate-spin"
									/>
									<span>Memverifikasi Hak Akses...</span>
								</>
							) : (
								<span>Masuk Sebagai {selectedPreset.roleLabel}</span>
							)}
						</button>
					</form>
				) : null}

				{status === "reset" ? (
					<button
						className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
						onClick={resetToForm}
						type="button"
					>
						Kembali ke Form Login
					</button>
				) : null}

				<div className="border-t border-border/80 pt-4 text-center">
					<p className="text-xs text-muted-foreground">
						Hak akses ditentukan secara otomatis di server berdasarkan pemetaan
						email pengguna pada lingkup KPPN / Satker.
					</p>
				</div>
			</div>

			{/* Comparison Matrix Modal */}
			{isMatrixOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
					<div className="w-full max-w-3xl rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
						<div className="flex items-start justify-between">
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<Scale className="size-4 text-primary" />
									<h3 className="text-base font-semibold text-foreground">
										Matriks Perbedaan Hak Akses
									</h3>
								</div>
								<p className="text-xs text-muted-foreground">
									Perbandingan kewenangan antara peran Admin KPPN vs Operator
									Satker
								</p>
							</div>
							<button
								type="button"
								onClick={() => setIsMatrixOpen(false)}
								className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
							>
								<X className="size-4" />
							</button>
						</div>

						<div className="overflow-x-auto rounded-lg border border-border/80">
							<table className="w-full text-left text-xs">
								<thead>
									<tr className="border-b border-border/80 bg-surface-muted/60 font-semibold text-muted-foreground">
										<th className="px-3.5 py-3">Modul &amp; Fitur</th>
										<th className="px-3.5 py-3 text-primary">
											Admin KPPN (Pembina)
										</th>
										<th className="px-3.5 py-3 text-foreground">
											Operator Satker
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/60">
									{mockPermissionMatrix.map((item) => (
										<tr
											key={item.moduleName}
											className="transition-colors hover:bg-surface-muted/30"
										>
											<td className="px-3.5 py-2.5 font-semibold text-foreground">
												{item.moduleName}
											</td>
											<td className="px-3.5 py-2.5 font-medium text-primary">
												{item.adminKppnAccess}
											</td>
											<td className="px-3.5 py-2.5 text-foreground">
												{item.operatorSatkerAccess}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className="flex items-center justify-between border-t border-border pt-3 text-xs">
							<span className="text-muted-foreground">
								Setiap peran memiliki isolasi data dan batasan kewenangan yang
								terjamin.
							</span>
							<button
								type="button"
								onClick={() => setIsMatrixOpen(false)}
								className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
							>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}

function ClerkSignInPanel({
	redirectIntent,
	className,
	...props
}: SignInPanelProps) {
	const safeRedirectIntent = isSafeRedirectIntent(redirectIntent)
		? redirectIntent
		: undefined;

	return (
		<section
			{...props}
			className={twMerge("w-full max-w-xl self-center space-y-5", className)}
			data-auth-provider="clerk"
			data-slot="sign-in-panel"
		>
			<Link
				to="/"
				className="inline-flex min-h-10 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				<ArrowLeft aria-hidden="true" className="size-4" />
				<span>Kembali ke Beranda</span>
			</Link>

			<div className="space-y-5 rounded-2xl border border-border bg-background p-3 shadow-sm sm:p-5">
				<div className="px-3 pt-2 sm:px-5">
					<p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
						Simulator IKPA
					</p>
					<h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
						Masuk ke Akun Anda
					</h1>
					<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
						Autentikasi dikelola oleh Clerk. Hak akses aplikasi tetap ditentukan
						server berdasarkan mapping internal.
					</p>
				</div>
				<ClerkSignIn
					routing="hash"
					forceRedirectUrl={safeRedirectIntent}
					fallbackRedirectUrl="/operator/dashboard"
				/>
			</div>
		</section>
	);
}

function MissingAuthConfiguration({
	redirectIntent: _redirectIntent,
	className,
	...props
}: SignInPanelProps) {
	return (
		<section
			{...props}
			className={twMerge("w-full max-w-xl self-center", className)}
			data-auth-provider="missing"
			data-slot="sign-in-panel"
		>
			<div className="rounded-2xl border border-warning/30 bg-warning-surface p-6 text-sm text-foreground shadow-sm sm:p-8">
				<h1 className="text-xl font-semibold">Login belum dikonfigurasi</h1>
				<p className="mt-2 leading-relaxed text-muted-foreground">
					Administrator perlu mengisi `VITE_CLERK_PUBLISHABLE_KEY` dan
					`CLERK_SECRET_KEY` sebelum aplikasi dijalankan di production.
				</p>
			</div>
		</section>
	);
}

export function SignInPanel(props: SignInPanelProps) {
	if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()) {
		return <ClerkSignInPanel {...props} />;
	}

	if (import.meta.env.DEV) {
		return <DemoSignInPanel {...props} />;
	}

	return <MissingAuthConfiguration {...props} />;
}
