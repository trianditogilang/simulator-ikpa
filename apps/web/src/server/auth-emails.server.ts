import { sendMail } from "./mailer.server";

export const OTP_VALID_MINUTES = 10;

const otpPurpose = {
	"email-verification": "memverifikasi alamat email Anda",
	"forget-password": "mengatur ulang kata sandi Anda",
	"new-device": "masuk dari perangkat atau browser baru",
} as const;

export type OtpPurpose = keyof typeof otpPurpose;

/** The code appears only in the body: subjects are commonly logged by MTAs. */
export async function sendOtpEmail(
	to: string,
	otp: string,
	purpose: OtpPurpose,
): Promise<void> {
	const text = [
		`Kode verifikasi Simulator IKPA untuk ${otpPurpose[purpose]}:`,
		"",
		otp,
		"",
		`Kode berlaku ${OTP_VALID_MINUTES} menit dan hanya dapat dipakai satu kali.`,
		"Jangan berikan kode ini kepada siapa pun. Abaikan email ini bila Anda tidak memintanya.",
	].join("\n");
	await sendMail({ to, subject: "Kode verifikasi Simulator IKPA", text });
}

export async function sendInvitationEmail(
	to: string,
	accessType: "operator_satker" | "admin_kppn",
): Promise<void> {
	const role = accessType === "admin_kppn" ? "Admin KPPN" : "Operator Satker";
	const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
	const text = [
		`Anda diundang menggunakan Simulator IKPA sebagai ${role}.`,
		"",
		`Daftar dengan alamat email ini di ${appUrl}/sign-up.`,
		"Akses Anda aktif otomatis setelah email terverifikasi.",
	].join("\n");
	await sendMail({ to, subject: "Undangan Simulator IKPA", text });
}
