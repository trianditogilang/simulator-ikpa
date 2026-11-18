// MIG-05 real-inbox check: sends one email through the product mailer
// (apps/web/src/server/mailer.server.ts) using SMTP settings from
// .env.smtp.local (gitignored) or the process environment.
//
//   node --import tsx scripts/smtp-smoke.mjs penerima@example.com
//
// Only SMTP_* and NOTIFICATION_SENDER_EMAIL are read from the file, and no
// value, recipient, or server reply is printed.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const KEYS = new Set(["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "NOTIFICATION_SENDER_EMAIL"]);
const envPath = resolve(".env.smtp.local");
if (existsSync(envPath)) {
	for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const match = rawLine.trim().match(/^([A-Z_]+)\s*=\s*(.*)$/);
		if (!match || !KEYS.has(match[1]) || process.env[match[1]] !== undefined) continue;
		process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
	}
}

const to = process.argv[2];
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
	console.error("Usage: node --import tsx scripts/smtp-smoke.mjs <recipient-email>");
	process.exit(2);
}
// Production mode: the mailer refuses to fall back to the local mail catcher.
process.env.NODE_ENV = "production";

const { sendMail } = await import("../apps/web/src/server/mailer.server.ts");
const sentAt = new Date().toISOString();
try {
	await sendMail({
		to,
		subject: "Uji SMTP Simulator IKPA",
		text: `Email uji keterkiriman Simulator IKPA (${sentAt}). Bila email ini ada di Kotak Masuk, SMTP siap dipakai.`,
	});
	console.log(`SMTP OK: 1 email accepted by the server at ${sentAt}. Check Inbox and Spam.`);
} catch (error) {
	console.error(`SMTP FAILED: ${error instanceof Error ? error.message : "unknown error"}`);
	process.exit(1);
}
