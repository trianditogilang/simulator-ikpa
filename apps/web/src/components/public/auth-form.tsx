import { LoaderCircle, LogIn, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/server/auth-session";

type Mode = "sign-in" | "sign-up" | "forgot";
/** Which email code the OTP step is waiting for. */
type OtpStep = "verify-email" | "new-device" | "reset";

type AuthError = { code?: string; status?: number } | null | undefined;

export function isSafeRedirectIntent(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length <= 512 &&
		value.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\") &&
		!/[\r\n]/.test(value)
	);
}

function describeError(error: AuthError): string {
	if (error?.status === 429) {
		return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
	}
	switch (error?.code) {
		case "INVALID_EMAIL_OR_PASSWORD":
			return "Email atau kata sandi salah.";
		case "INVALID_OTP":
		case "INVALID_CODE":
			return "Kode salah. Periksa kembali email Anda.";
		case "OTP_EXPIRED":
		case "OTP_HAS_EXPIRED":
			return "Kode kedaluwarsa. Minta kode baru.";
		case "TOO_MANY_ATTEMPTS":
		case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
			return "Terlalu banyak percobaan salah. Minta kode baru.";
		case "PASSWORD_TOO_SHORT":
			return `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`;
		case "USER_ALREADY_EXISTS":
		case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
			return "Email sudah terdaftar. Silakan masuk.";
		default:
			return "Permintaan gagal. Coba lagi.";
	}
}

const inputClass =
	"min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60";
const labelClass = "block text-xs font-semibold text-foreground";
const primaryButtonClass =
	"inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";
const linkButtonClass =
	"text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";

const otpHint: Record<OtpStep, string> = {
	"verify-email": "untuk memverifikasi email Anda",
	"new-device": "karena Anda masuk dari perangkat atau browser baru",
	reset: "untuk mengatur ulang kata sandi",
};

export type AuthFormProps = {
	initialMode?: "sign-in" | "sign-up";
	/** Internal path to open after sign-in; resolved by `/sign-in` otherwise. */
	redirectTo?: string;
};

/**
 * Email + password sign-in, self sign-up, and password reset. Each flow ends
 * with a 6-digit code sent by email when required (ADR-008).
 */
export function AuthForm({ initialMode = "sign-in", redirectTo }: AuthFormProps) {
	const [mode, setMode] = useState<Mode>(initialMode);
	const [otpStep, setOtpStep] = useState<OtpStep | null>(null);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const destination = isSafeRedirectIntent(redirectTo) ? redirectTo : "/sign-in";

	function switchMode(next: Mode) {
		setMode(next);
		setOtpStep(null);
		setOtp("");
		setPassword("");
		setError(null);
		setNotice(null);
	}

	/** Runs one auth call; returns false after showing its error. */
	async function run(
		call: () => Promise<{ error?: AuthError }>,
	): Promise<boolean> {
		setBusy(true);
		setError(null);
		setNotice(null);
		try {
			const result = await call();
			if (result.error) {
				setError(describeError(result.error));
				return false;
			}
			return true;
		} catch {
			setError("Tidak dapat menghubungi server. Coba lagi.");
			return false;
		} finally {
			setBusy(false);
		}
	}

	async function submitCredentials(event: FormEvent) {
		event.preventDefault();
		const normalizedEmail = email.trim().toLowerCase();

		if (mode === "sign-up") {
			const created = await run(() =>
				authClient.signUp.email({
					name: name.trim(),
					email: normalizedEmail,
					password,
				}),
			);
			if (created) setOtpStep("verify-email");
			return;
		}

		if (mode === "forgot") {
			const requested = await run(() =>
				authClient.emailOtp.requestPasswordReset({ email: normalizedEmail }),
			);
			if (requested) {
				setPassword("");
				setOtpStep("reset");
			}
			return;
		}

		setBusy(true);
		setError(null);
		setNotice(null);
		try {
			const { data, error: signInError } = await authClient.signIn.email({
				email: normalizedEmail,
				password,
			});
			if (signInError?.code === "EMAIL_NOT_VERIFIED") {
				// The server already sent a fresh verification code.
				setOtpStep("verify-email");
			} else if (signInError) {
				setError(describeError(signInError));
			} else if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
				const sent = await authClient.twoFactor.sendOtp();
				if (sent.error) setError(describeError(sent.error));
				else setOtpStep("new-device");
			} else {
				window.location.assign(destination);
				return;
			}
		} catch {
			setError("Tidak dapat menghubungi server. Coba lagi.");
		}
		setBusy(false);
	}

	async function submitOtp(event: FormEvent) {
		event.preventDefault();
		const normalizedEmail = email.trim().toLowerCase();
		const code = otp.trim();

		if (otpStep === "reset") {
			const done = await run(() =>
				authClient.emailOtp.resetPassword({
					email: normalizedEmail,
					otp: code,
					password,
				}),
			);
			if (done) {
				switchMode("sign-in");
				setNotice("Kata sandi diperbarui. Silakan masuk.");
			}
			return;
		}

		const verified = await run(() =>
			otpStep === "new-device"
				? authClient.twoFactor.verifyOtp({ code, trustDevice: true })
				: authClient.emailOtp.verifyEmail({ email: normalizedEmail, otp: code }),
		);
		if (verified) window.location.assign(destination);
	}

	async function resendOtp() {
		const normalizedEmail = email.trim().toLowerCase();
		const sent = await run(() => {
			if (otpStep === "new-device") return authClient.twoFactor.sendOtp();
			if (otpStep === "reset") {
				return authClient.emailOtp.requestPasswordReset({
					email: normalizedEmail,
				});
			}
			return authClient.emailOtp.sendVerificationOtp({
				email: normalizedEmail,
				type: "email-verification",
			});
		});
		if (sent) setNotice("Kode baru telah dikirim.");
	}

	const feedback = (
		<div aria-live="polite">
			{error ? (
				<p
					role="alert"
					className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger"
				>
					{error}
				</p>
			) : null}
			{notice ? (
				<p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-foreground">
					{notice}
				</p>
			) : null}
		</div>
	);

	const spinner = busy ? (
		<LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
	) : null;

	if (otpStep) {
		return (
			<form
				className="w-full space-y-4"
				data-slot="auth-otp-form"
				onSubmit={submitOtp}
			>
				<p className="text-xs leading-relaxed text-muted-foreground">
					Kami mengirim kode 6 digit ke <strong>{email.trim()}</strong>{" "}
					{otpHint[otpStep]}. Kode berlaku 10 menit.
				</p>
				<div className="space-y-1.5">
					<label className={labelClass} htmlFor="auth-otp">
						Kode verifikasi
					</label>
					<input
						autoComplete="one-time-code"
						className={`${inputClass} tracking-[0.4em]`}
						disabled={busy}
						id="auth-otp"
						inputMode="numeric"
						maxLength={6}
						name="otp"
						onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
						pattern="[0-9]{6}"
						required
						value={otp}
					/>
				</div>
				{otpStep === "reset" ? (
					<div className="space-y-1.5">
						<label className={labelClass} htmlFor="auth-new-password">
							Kata sandi baru
						</label>
						<input
							autoComplete="new-password"
							className={inputClass}
							disabled={busy}
							id="auth-new-password"
							minLength={MIN_PASSWORD_LENGTH}
							name="new-password"
							onChange={(event) => setPassword(event.target.value)}
							required
							type="password"
							value={password}
						/>
						<p className="text-[11px] text-muted-foreground">
							Minimal {MIN_PASSWORD_LENGTH} karakter.
						</p>
					</div>
				) : null}
				{feedback}
				<button className={primaryButtonClass} disabled={busy} type="submit">
					{spinner}
					<span>{otpStep === "reset" ? "Simpan kata sandi" : "Verifikasi"}</span>
				</button>
				<div className="flex items-center justify-between">
					<button
						className={linkButtonClass}
						disabled={busy}
						onClick={resendOtp}
						type="button"
					>
						Kirim ulang kode
					</button>
					<button
						className={linkButtonClass}
						disabled={busy}
						onClick={() => switchMode("sign-in")}
						type="button"
					>
						Kembali
					</button>
				</div>
			</form>
		);
	}

	return (
		<div className="w-full space-y-4" data-slot="auth-form">
			{mode === "forgot" ? null : (
				<div className="flex rounded-xl border border-border bg-surface p-1 text-xs font-semibold">
					{(
						[
							["sign-in", "Masuk", LogIn],
							["sign-up", "Daftar Akun Baru", UserPlus],
						] as const
					).map(([value, label, Icon]) => (
						<button
							aria-pressed={mode === value}
							className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${
								mode === value
									? "bg-background text-primary shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
							key={value}
							onClick={() => switchMode(value)}
							type="button"
						>
							<Icon aria-hidden="true" className="size-3.5" />
							<span>{label}</span>
						</button>
					))}
				</div>
			)}

			<form className="space-y-4" onSubmit={submitCredentials}>
				{mode === "forgot" ? (
					<p className="text-xs leading-relaxed text-muted-foreground">
						Masukkan email akun Anda. Bila terdaftar, kami mengirim kode untuk
						mengatur ulang kata sandi.
					</p>
				) : null}
				{mode === "sign-up" ? (
					<div className="space-y-1.5">
						<label className={labelClass} htmlFor="auth-name">
							Nama lengkap
						</label>
						<input
							autoComplete="name"
							className={inputClass}
							disabled={busy}
							id="auth-name"
							name="name"
							onChange={(event) => setName(event.target.value)}
							required
							value={name}
						/>
					</div>
				) : null}
				<div className="space-y-1.5">
					<label className={labelClass} htmlFor="auth-email">
						Email
					</label>
					<input
						autoComplete="email"
						className={inputClass}
						disabled={busy}
						id="auth-email"
						name="email"
						onChange={(event) => setEmail(event.target.value)}
						required
						type="email"
						value={email}
					/>
				</div>
				{mode === "forgot" ? null : (
					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<label className={labelClass} htmlFor="auth-password">
								Kata sandi
							</label>
							{mode === "sign-in" ? (
								<button
									className={linkButtonClass}
									onClick={() => switchMode("forgot")}
									type="button"
								>
									Lupa kata sandi?
								</button>
							) : null}
						</div>
						<input
							autoComplete={
								mode === "sign-up" ? "new-password" : "current-password"
							}
							className={inputClass}
							disabled={busy}
							id="auth-password"
							minLength={mode === "sign-up" ? MIN_PASSWORD_LENGTH : undefined}
							name="password"
							onChange={(event) => setPassword(event.target.value)}
							required
							type="password"
							value={password}
						/>
						{mode === "sign-up" ? (
							<p className="text-[11px] text-muted-foreground">
								Minimal {MIN_PASSWORD_LENGTH} karakter.
							</p>
						) : null}
					</div>
				)}
				{feedback}
				<button className={primaryButtonClass} disabled={busy} type="submit">
					{spinner}
					<span>
						{mode === "sign-up"
							? "Daftar"
							: mode === "forgot"
								? "Kirim kode"
								: "Masuk"}
					</span>
				</button>
				{mode === "forgot" ? (
					<button
						className={linkButtonClass}
						onClick={() => switchMode("sign-in")}
						type="button"
					>
						Kembali ke halaman masuk
					</button>
				) : null}
			</form>
		</div>
	);
}
