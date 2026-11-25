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

function appUrl(): string {
	return (process.env.APP_URL ?? "").replace(/\/$/, "");
}

export async function sendInvitationEmail(
	to: string,
	accessType: "operator_satker" | "admin_kppn",
): Promise<void> {
	const role = accessType === "admin_kppn" ? "Admin KPPN" : "Operator Satker";
	const text = [
		`Anda diundang menggunakan Simulator IKPA sebagai ${role}.`,
		"",
		`1. Buka ${appUrl()}/sign-in.`,
		'2. Klik "Lupa kata sandi?" dan masukkan alamat email ini.',
		"3. Masukkan kode yang kami kirim, lalu buat kata sandi Anda.",
		"",
		"Akses Anda sudah aktif dan dapat dipakai setelah kata sandi dibuat.",
	].join("\n");
	await sendMail({ to, subject: "Undangan Simulator IKPA", text });
}

/** Tells a self-service requester the Admin KPPN decision. */
export async function sendAccessRequestDecisionEmail(
	to: string,
	decision: "approved" | "rejected",
	satker: { kodeSatker: string; satkerName: string },
): Promise<void> {
	const label = `${satker.kodeSatker} - ${satker.satkerName}`;
	const text =
		decision === "approved"
			? [
					`Permintaan akses Operator Satker untuk ${label} telah disetujui Admin KPPN.`,
					"",
					`Masuk di ${appUrl()}/sign-in untuk mulai menggunakan Simulator IKPA.`,
				].join("\n")
			: [
					`Permintaan akses Operator Satker untuk ${label} ditolak Admin KPPN.`,
					"",
					`Periksa kembali kode dan nama satker di ${appUrl()}/sign-in, lalu ajukan ulang atau hubungi Admin KPPN.`,
				].join("\n");
	await sendMail({
		to,
		subject:
			decision === "approved"
				? "Akses Simulator IKPA disetujui"
				: "Permintaan akses Simulator IKPA ditolak",
		text,
	});
}
