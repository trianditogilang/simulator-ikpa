import { useState, type ComponentProps, type FormEvent } from "react";
import { twMerge } from "tailwind-merge";
import { mockAuthPresets } from "@/mocks/auth-presets";
import { CheckCircle2, ShieldCheck, User } from "lucide-react";

export type AuthCardProps = ComponentProps<"div"> & {
	onSuccessRedirect?: string;
};

function getDestinationForEmail(email: string, fallback?: string): string {
	const lower = email.toLowerCase().trim();
	const matched = mockAuthPresets.find((p) => p.email.toLowerCase() === lower);
	if (matched) {
		return matched.targetPath;
	}

	if (
		lower.includes("admin") ||
		lower.includes("kppn") ||
		lower.includes("pembina")
	) {
		return "/admin-kppn/dashboard";
	}

	if (
		lower.includes("satker") ||
		lower.includes("operator") ||
		lower.includes("polinema") ||
		lower.includes("btn") ||
		lower.includes("pn-") ||
		lower.includes("imigrasi")
	) {
		return "/operator/dashboard";
	}

	if (lower.includes("wilayah") || lower.includes("multi")) {
		return "/select-organization";
	}

	return fallback || "/operator/dashboard";
}

export function AuthCard({
	onSuccessRedirect,
	className,
	...props
}: AuthCardProps) {
	const [mode, setMode] = useState<"signin" | "signup">("signin");
	const [email, setEmail] = useState("admin.kppn@kemenkeu.go.id");
	const [password, setPassword] = useState("password123");
	const [fullName, setFullName] = useState("");
	const [satkerCode, setSatkerCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const targetPath = getDestinationForEmail(email, onSuccessRedirect);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setErrorMessage(null);

		setTimeout(() => {
			setIsLoading(false);
			if (!email.includes("@") || !email.includes(".")) {
				setErrorMessage("Format email tidak valid.");
				return;
			}

			if (password.length < 8) {
				setErrorMessage("Kata sandi minimal 8 karakter.");
				return;
			}

			const destination = getDestinationForEmail(email, onSuccessRedirect);
			window.location.href = destination;
		}, 450);
	};

	const handleQuickFill = (role: "admin" | "operator") => {
		if (role === "admin") {
			setEmail("admin.kppn@kemenkeu.go.id");
			setPassword("password123");
		} else {
			setEmail("bambang.keu@polinema.ac.id");
			setPassword("password123");
		}
		setErrorMessage(null);
	};

	return (
		<div
			{...props}
			className={twMerge(
				"relative w-full rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6 space-y-3.5",
				className,
			)}
			data-slot="auth-card"
		>
			{/* Tab Selector */}
			<div className="flex rounded-lg bg-surface-muted p-1">
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

			<div className="space-y-0.5">
				<h2 className="text-sm font-semibold text-foreground sm:text-base">
					{mode === "signin" ? "Masuk ke Akun Anda" : "Pendaftaran Akun Baru"}
				</h2>
				<p className="text-xs text-muted-foreground">
					{mode === "signin"
						? "Gunakan email kedinasan terdaftar untuk simulasi satker / monitoring admin."
						: "Daftarkan akun operator untuk verifikasi oleh Admin KPPN."}
				</p>
			</div>

			{/* Quick Preset Buttons */}
			{mode === "signin" && (
				<div className="space-y-1.5 rounded-lg border border-border/80 bg-surface p-2.5 text-xs">
					<div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
						<span>Pilihan Akun Demo:</span>
						<span className="font-normal">Klik untuk mengisi</span>
					</div>
					<div className="grid grid-cols-2 gap-1.5">
						<button
							type="button"
							onClick={() => handleQuickFill("admin")}
							className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
								email === "admin.kppn@kemenkeu.go.id"
									? "border-primary bg-primary/10 text-primary shadow-xs"
									: "border-border/80 bg-background text-foreground hover:bg-surface-muted"
							}`}
						>
							<div className="flex items-center gap-1.5 truncate">
								<ShieldCheck className="size-3.5 shrink-0 text-primary" />
								<span className="truncate">Admin KPPN</span>
							</div>
							{email === "admin.kppn@kemenkeu.go.id" && (
								<CheckCircle2 className="size-3 text-primary shrink-0" />
							)}
						</button>

						<button
							type="button"
							onClick={() => handleQuickFill("operator")}
							className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs font-semibold transition ${
								email === "bambang.keu@polinema.ac.id"
									? "border-success bg-success/10 text-success shadow-xs"
									: "border-border/80 bg-background text-foreground hover:bg-surface-muted"
							}`}
						>
							<div className="flex items-center gap-1.5 truncate">
								<User className="size-3.5 shrink-0 text-success" />
								<span className="truncate">Operator Satker</span>
							</div>
							{email === "bambang.keu@polinema.ac.id" && (
								<CheckCircle2 className="size-3 text-success shrink-0" />
							)}
						</button>
					</div>

					<div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-0.5">
						<span>Tujuan:</span>
						<code className="rounded bg-background px-1 py-0.5 font-semibold text-foreground">
							{targetPath}
						</code>
					</div>
				</div>
			)}

			{errorMessage && (
				<div className="rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger">
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
								className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
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
								className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
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
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
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
										"Silakan gunakan password demo 'password123' atau hubungi Admin KPPN.",
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
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
					/>
				</div>

				<button
					type="submit"
					disabled={isLoading}
					className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 focus:border-primary focus:outline-none disabled:opacity-50 sm:text-sm"
				>
					{isLoading
						? "Memverifikasi Akses..."
						: mode === "signin"
							? `Masuk ke ${targetPath.includes("admin") ? "Dashboard Admin KPPN" : "Dashboard Operator Satker"}`
							: "Daftar Akun"}
				</button>
			</form>

			<div className="border-t border-border pt-2 text-center">
				<p className="text-[11px] text-muted-foreground">
					Akses Operator Satker / Admin KPPN diarahkan otomatis sesuai email terdaftar.
				</p>
			</div>
		</div>
	);
}
