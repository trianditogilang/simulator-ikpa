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
	CLERK_SECRET_KEY: z.string().optional(),
	VITE_CLERK_PUBLISHABLE_KEY: z.string().optional(),
	RESEND_API_KEY: z.string().optional(),
	NOTIFICATION_SENDER_EMAIL: z
		.string()
		.email()
		.default("notifikasi-ikpa@kemenkeu.go.id"),
	QSTASH_TOKEN: z.string().optional(),
	QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
	QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
	R2_ACCOUNT_ID: z.string().optional(),
	R2_ACCESS_KEY_ID: z.string().optional(),
	R2_SECRET_ACCESS_KEY: z.string().optional(),
	R2_BUCKET_NAME: z.string().default("simulator-ikpa-imports"),
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
		if (!parsed.data.CLERK_SECRET_KEY) {
			missingProductionEnvs.push("CLERK_SECRET_KEY");
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
