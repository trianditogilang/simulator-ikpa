import { useState, type ComponentProps, type FormEvent } from "react";
import { twMerge } from "tailwind-merge";

export type AuthCardProps = ComponentProps<"div"> & {
	onSuccessRedirect?: string;
};

export function AuthCard({
	onSuccessRedirect = "/operator/dashboard",
	className,
	...props
}: AuthCardProps) {
	const [mode, setMode] = useState<"signin" | "signup">("signin");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [fullName, setFullName] = useState("");
	const [satkerCode, setSatkerCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setErrorMessage(null);

		setTimeout(() => {
			setIsLoading(false);
			if (!email.includes("@")) {
				setErrorMessage("Format email tidak valid");
				return;
			}
			window.location.href = onSuccessRedirect;
		}, 600);
	};

	return (
		<div
			{...props}
			className={twMerge(
				"relative w-full rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6",
				className,
			)}
			data-slot="auth-card"
		>
			{/* Tab Selector */}
			<div className="mb-4 flex rounded-lg bg-surface-muted p-1">
				<button
					type="button"
					onClick={() => {
						setMode("signin");
						setErrorMessage(null);
					}}
					className={twMerge(
						"flex-1 rounded-md py-1.5 text-xs font-semibold transition",
						mode === "signin"
							? "bg-background text-foreground shadow-xs"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					Masuk (Sign In)
				</button>
				<button
					type="button"
					onClick={() => {
						setMode("signup");
						setErrorMessage(null);
					}}
					className={twMerge(
						"flex-1 rounded-md py-1.5 text-xs font-semibold transition",
						mode === "signup"
							? "bg-background text-foreground shadow-xs"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					Daftar (Sign Up)
				</button>
			</div>

			<div className="mb-4 space-y-0.5">
				<h2 className="text-sm font-semibold text-foreground sm:text-base">
					{mode === "signin" ? "Masuk ke Akun Anda" : "Pendaftaran Akun Baru"}
				</h2>
				<p className="text-xs text-muted-foreground">
					{mode === "signin"
						? "Gunakan email kedinasan terdaftar untuk simulasi satker."
						: "Daftarkan akun operator untuk aktivasi oleh Admin KPPN."}
				</p>
			</div>

			{errorMessage && (
				<div className="mb-3 rounded-lg border border-danger/30 bg-danger-surface p-2.5 text-xs text-danger">
					{errorMessage}
				</div>
			)}

			<form onSubmit={handleSubmit} className="space-y-3">
				{mode === "signup" && (
					<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
						<div className="space-y-1">
							<label
								htmlFor="fullName"
								className="block text-[11px] font-semibold text-foreground"
							>
								Nama Lengkap
							</label>
							<input
								id="fullName"
								type="text"
								required
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								placeholder="Nama Pengguna"
								className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>

						<div className="space-y-1">
							<label
								htmlFor="satkerCode"
								className="block text-[11px] font-semibold text-foreground"
							>
								Kode 6 Digit Satker
							</label>
							<input
								id="satkerCode"
								type="text"
								required
								maxLength={6}
								value={satkerCode}
								onChange={(e) => setSatkerCode(e.target.value)}
								placeholder="123456"
								className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
					</div>
				)}

				<div className="space-y-1">
					<label
						htmlFor="email"
						className="block text-[11px] font-semibold text-foreground"
					>
						Email Kedinasan
					</label>
					<input
						id="email"
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="nama@kemenkeu.go.id"
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
					/>
				</div>

				<div className="space-y-1">
					<div className="flex items-center justify-between">
						<label
							htmlFor="password"
							className="block text-[11px] font-semibold text-foreground"
						>
							Kata Sandi
						</label>
						{mode === "signin" && (
							<button
								type="button"
								onClick={() => {
									alert(
										"Silakan hubungi Admin KPPN untuk pemulihan kata sandi.",
									);
								}}
								className="cursor-pointer text-[11px] font-medium text-primary hover:underline"
							>
								Lupa sandi?
							</button>
						)}
					</div>
					<input
						id="password"
						type="password"
						required
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="••••••••"
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
					/>
				</div>

				<button
					type="submit"
					disabled={isLoading}
					className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 sm:text-sm"
				>
					{isLoading
						? "Memproses..."
						: mode === "signin"
							? "Masuk ke Sistem"
							: "Daftar Akun"}
				</button>
			</form>

			<div className="mt-3 border-t border-border pt-2 text-center">
				<p className="text-[11px] text-muted-foreground">
					Akses Operator Satker / Admin KPPN disesuaikan otomatis saat masuk.
				</p>
			</div>
		</div>
	);
}
