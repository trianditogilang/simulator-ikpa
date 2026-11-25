import nodemailer, { type Transporter } from "nodemailer";

export class MailerError extends Error {
	constructor(public readonly code: "SMTP_NOT_CONFIGURED" | "SMTP_SEND_FAILED") {
		super(code);
		this.name = "MailerError";
	}
}

export interface OutgoingMail {
	to: string | string[];
	subject: string;
	text: string;
	html?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
	if (transporter) return transporter;

	const host = process.env.SMTP_HOST?.trim();
	if (!host && process.env.NODE_ENV === "production") {
		throw new MailerError("SMTP_NOT_CONFIGURED");
	}
	// Outside production the default is the local mail catcher (Mailpit).
	const port = Number(process.env.SMTP_PORT || 1025);
	const user = process.env.SMTP_USER?.trim();

	transporter = nodemailer.createTransport({
		host: host || "127.0.0.1",
		port,
		secure: port === 465,
		auth: user ? { user, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
	});
	return transporter;
}

/**
 * Sends one email over SMTP and returns the provider message id.
 * Recipients, subject, and body are never logged or put into the thrown error,
 * so OTP codes and recipient lists cannot leak through logs or responses.
 */
export async function sendMail(mail: OutgoingMail): Promise<string> {
	const from = process.env.NOTIFICATION_SENDER_EMAIL?.trim();
	if (!from) throw new MailerError("SMTP_NOT_CONFIGURED");

	try {
		const info = await getTransporter().sendMail({ from, ...mail });
		return String(info.messageId ?? "");
	} catch (error) {
		if (error instanceof MailerError) throw error;
		throw new MailerError("SMTP_SEND_FAILED");
	}
}
