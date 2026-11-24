import { randomBytes } from "node:crypto";

/**
 * Test-only helpers for the F13 runners (ADR-008, MIG-03).
 *
 * Sessions are obtained through the real Better Auth flows: the fixture account
 * gets a throwaway password via the email-OTP reset, then signs in and passes
 * the new-device OTP. Codes are read from the local mail catcher (Mailpit), so
 * no credential is stored anywhere and nothing is ever sent to a real mailbox.
 */

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Fixtures write to the database and trigger email: never off this machine. */
export function assertLoopbackUrl(url, label) {
	let host;
	try {
		host = new URL(url).hostname;
	} catch {
		throw new Error(`${label} is not a valid URL.`);
	}
	if (!LOOPBACK_HOSTS.has(host)) {
		throw new Error(
			`${label} must point to this machine (127.0.0.1). Refusing to run against a remote host.`,
		);
	}
}

/** Environment for a dev server whose email can only reach the mail catcher. */
export function localAuthEnv(appUrl) {
	return {
		APP_URL: appUrl,
		BETTER_AUTH_SECRET:
			process.env.BETTER_AUTH_SECRET || randomBytes(32).toString("base64url"),
		SMTP_HOST: "127.0.0.1",
		SMTP_PORT: process.env.MAILPIT_SMTP_PORT || "1025",
		SMTP_USER: "",
		SMTP_PASSWORD: "",
		NOTIFICATION_SENDER_EMAIL:
			process.env.NOTIFICATION_SENDER_EMAIL || "notifikasi-ikpa@example.test",
	};
}

function mailpitUrl() {
	const url = process.env.MAILPIT_URL || "http://127.0.0.1:8025";
	assertLoopbackUrl(url, "MAILPIT_URL");
	return url;
}

async function clearMailbox(email) {
	const query = encodeURIComponent(`to:"${email}"`);
	await fetch(`${mailpitUrl()}/api/v1/search?query=${query}`, {
		method: "DELETE",
	});
}

async function waitForOtp(email, timeoutMs = 20_000) {
	const query = encodeURIComponent(`to:"${email}"`);
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const list = await (
			await fetch(`${mailpitUrl()}/api/v1/search?query=${query}`)
		).json();
		const id = list.messages?.[0]?.ID;
		if (id) {
			const message = await (
				await fetch(`${mailpitUrl()}/api/v1/message/${id}`)
			).json();
			const code = String(message.Text ?? "").match(/\b\d{6}\b/)?.[0];
			if (code) return code;
		}
		await new Promise((resolve) => setTimeout(resolve, 300));
	}
	throw new Error("No verification code arrived in the local mail catcher.");
}

/**
 * Returns a `Cookie` header value holding a fresh session for `email`.
 * Error messages never include the code, password, or cookie.
 */
export async function createFixtureSession({ baseUrl, email }) {
	const jar = new Map();
	const post = async (path, body) => {
		const response = await fetch(`${baseUrl}/api/auth${path}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: baseUrl,
				cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
			},
			body: JSON.stringify(body),
		});
		for (const cookie of response.headers.getSetCookie()) {
			const [pair] = cookie.split(";");
			const separator = pair.indexOf("=");
			const name = pair.slice(0, separator).trim();
			const value = pair.slice(separator + 1);
			if (value && !/max-age=0/i.test(cookie)) jar.set(name, value);
			else jar.delete(name);
		}
		if (!response.ok) {
			throw new Error(`Auth fixture step ${path} failed (${response.status}).`);
		}
		return response.json().catch(() => null);
	};

	// Suffix guarantees the letter + digit rule that base64url alone may miss.
	const password = `${randomBytes(24).toString("base64url")}a1`;

	await clearMailbox(email);
	await post("/email-otp/request-password-reset", { email });
	await post("/email-otp/reset-password", {
		email,
		otp: await waitForOtp(email),
		password,
	});

	await clearMailbox(email);
	const signIn = await post("/sign-in/email", { email, password });
	if (signIn?.twoFactorRedirect) {
		await post("/two-factor/send-otp", {});
		await post("/two-factor/verify-otp", {
			code: await waitForOtp(email),
			trustDevice: false,
		});
	}

	const session = [...jar].filter(([name]) => name.includes("session_token"));
	if (session.length === 0) {
		throw new Error("Auth fixture did not receive a session cookie.");
	}
	return session.map(([name, value]) => `${name}=${value}`).join("; ");
}
