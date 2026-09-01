import {
	AlertCircle,
	ArrowLeft,
	CheckCircle2,
	KeyRound,
	LoaderCircle,
	ShieldCheck,
} from "lucide-react";
import { useState, type ComponentProps, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { twMerge } from "tailwind-merge";

type SignInStatus = "idle" | "loading" | "error" | "reset" | "mfa" | "success";

export type SignInPanelProps = Omit<ComponentProps<"section">, "children"> & {
	redirectIntent?: string;
};

const defaultRedirectIntent = "/access-pending";

function getSafeRedirectIntent(value: string | undefined) {
	return value?.startsWith("/") && !value.startsWith("//")
		? value
		: defaultRedirectIntent;
}

export function SignInPanel({
	redirectIntent,
	className,
	...props
}: SignInPanelProps) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [status, setStatus] = useState<SignInStatus>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const safeRedirectIntent = getSafeRedirectIntent(redirectIntent);
	const isBusy = status === "loading";

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
		await new Promise((resolve) => window.setTimeout(resolve, 550));
		setStatus("success");
	};

	const resetToForm = () => {
		setStatus("idle");
		setErrorMessage(null);
	};

	return (
		<section
			{...props}
			className={twMerge("w-full max-w-md self-center", className)}
			data-slot="sign-in-panel"
		>
			<Link
				to="/"
				className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				<ArrowLeft aria-hidden="true" className="size-4" />
				Kembali ke beranda
			</Link>

			<div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
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
							Masuk ke akun Anda
						</h1>
					</div>
				</div>

				<p className="mt-4 text-sm leading-relaxed text-muted-foreground">
					Gunakan email kedinasan terdaftar. Setelah login, akses ditentukan
					sesuai mapping Operator Satker atau Admin KPPN.
				</p>

				<div className="mt-5 flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-surface px-3 py-2.5 text-info">
					<ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
					<p className="text-xs leading-relaxed">
						Intent demo setelah login: sistem akan melanjutkan ke{" "}
						<code className="rounded bg-background/70 px-1.5 py-0.5 font-semibold">
							{safeRedirectIntent}
						</code>
					</p>
				</div>

				{status === "error" && errorMessage ? (
					<div
						aria-live="assertive"
						className="mt-4 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-surface px-3 py-2.5 text-danger"
						role="alert"
					>
						<AlertCircle
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0"
						/>
						<p className="text-xs leading-relaxed">{errorMessage}</p>
					</div>
				) : null}

				{status === "reset" ? (
					<div
						aria-live="polite"
						className="mt-4 flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-surface px-3 py-2.5 text-info"
					>
						<KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
						<div className="space-y-1">
							<p className="text-xs font-semibold">Pemulihan kata sandi</p>
							<p className="text-xs leading-relaxed">
								Fitur reset password akan tersedia melalui Clerk. Untuk dummy
								ini, hubungi Admin KPPN.
							</p>
						</div>
					</div>
				) : null}

				{status === "success" ? (
					<div
						aria-live="polite"
						className="mt-5 rounded-xl border border-success/30 bg-success-surface p-4"
					>
						<div className="flex items-start gap-2.5 text-success">
							<CheckCircle2
								aria-hidden="true"
								className="mt-0.5 size-5 shrink-0"
							/>
							<div>
								<p className="text-sm font-semibold">Login dummy berhasil</p>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									Tahap berikutnya menunggu pemeriksaan mapping akses.
								</p>
							</div>
						</div>
						<div className="mt-4 flex flex-col gap-2 sm:flex-row">
							<a
								className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
								href={safeRedirectIntent}
							>
								Lanjutkan demo
							</a>
							<button
								className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
								onClick={() => setStatus("mfa")}
								type="button"
							>
								Lihat langkah MFA
							</button>
						</div>
					</div>
				) : null}

				{status === "mfa" ? (
					<div
						aria-live="polite"
						className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4"
					>
						<div className="flex items-start gap-2.5">
							<ShieldCheck
								aria-hidden="true"
								className="mt-0.5 size-5 shrink-0 text-primary"
							/>
							<div>
								<p className="text-sm font-semibold text-foreground">
									Verifikasi MFA (placeholder)
								</p>
								<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
									Clerk akan menangani kode verifikasi pada integrasi
									autentikasi.
								</p>
							</div>
						</div>
						<button
							className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
							onClick={() => setStatus("success")}
							type="button"
						>
							Kembali ke hasil login
						</button>
					</div>
				) : null}

				{status !== "success" && status !== "mfa" ? (
					<form className="mt-6 space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-1.5">
							<label
								className="block text-xs font-semibold text-foreground"
								htmlFor="sign-in-email"
							>
								Email kedinasan
							</label>
							<input
								autoComplete="email"
								className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surface-muted"
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
									Kata sandi
								</label>
								<button
									className="min-h-10 rounded-md px-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
								className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-surface-muted"
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
							<p className="text-xs text-muted-foreground">
								Kata sandi minimal 8 karakter.
							</p>
						</div>

						<button
							className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isBusy}
							type="submit"
						>
							{isBusy ? (
								<>
									<LoaderCircle
										aria-hidden="true"
										className="size-4 animate-spin"
									/>
									Memeriksa akses...
								</>
							) : (
								"Masuk ke sistem"
							)}
						</button>
					</form>
				) : null}

				{status === "reset" ? (
					<button
						className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
						onClick={resetToForm}
						type="button"
					>
						Kembali ke form login
					</button>
				) : null}

				<div className="mt-6 border-t border-border pt-4">
					<p className="text-center text-xs leading-relaxed text-muted-foreground">
						Akses ditentukan setelah autentikasi dan tidak dapat dipilih dari
						sisi pengguna.
					</p>
				</div>
			</div>
		</section>
	);
}
