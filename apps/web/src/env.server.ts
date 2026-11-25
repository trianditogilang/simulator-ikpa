import { z } from "zod";

const serverEnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	DATABASE_URL: z
		.string()
		.min(1, "DATABASE_URL is required for database connection")
		.optional(),
	DIRECT_URL: z.string().optional(),
	// Session/cookie signing secret for Better Auth (ADR-008, MIG-03).
	BETTER_AUTH_SECRET: z.string().min(32).optional(),
	// SMTP (ADR-008, MIG-05). Outside production the default is the local
	// mail catcher on 127.0.0.1:1025.
	SMTP_HOST: z.string().optional(),
	SMTP_PORT: z.coerce.number().int().positive().optional(),
	SMTP_USER: z.string().optional(),
	SMTP_PASSWORD: z.string().optional(),
	NOTIFICATION_SENDER_EMAIL: z
		.string()
		.email()
		.default("notifikasi-ikpa@kemenkeu.go.id"),
	// Bearer secret the VPS scheduler sends to /api/jobs/* (ADR-008, MIG-04).
	JOB_SECRET: z.string().min(32).optional(),
	APP_URL: z.string().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function validateServerEnv(): ServerEnv {
	const parsed = serverEnvSchema.safeParse(process.env);

	if (!parsed.success) {
		const formattedErrors = parsed.error.issues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");

		throw new Error(
			`[FATAL] Invalid server environment configuration:\n${formattedErrors}\n` +
				"Please check your .env file against .env.example.",
		);
	}

	// Production invariants
	if (parsed.data.NODE_ENV === "production") {
		const missingProductionEnvs: string[] = [];

		if (!parsed.data.DATABASE_URL) {
			missingProductionEnvs.push("DATABASE_URL");
		}
		if (!parsed.data.BETTER_AUTH_SECRET) {
			missingProductionEnvs.push("BETTER_AUTH_SECRET");
		}
		if (!parsed.data.SMTP_HOST) {
			missingProductionEnvs.push("SMTP_HOST");
		}

		if (missingProductionEnvs.length > 0) {
			throw new Error(
				`[FATAL] Missing required production environment variables: ${missingProductionEnvs.join(", ")}.\n` +
					"The server cannot safely start in production without these secrets configured.",
			);
		}
	}

	return parsed.data;
}

export const serverEnv = validateServerEnv();
