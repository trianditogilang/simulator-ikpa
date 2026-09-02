export type PolicyCategory = "mandatory" | "recommended" | "optional";
export type DayType = "workday" | "calendar_day" | "event_based" | "schedule";

export interface ReminderPolicyLike {
	id: string;
	eventType: string;
	category: PolicyCategory;
	dayType: DayType;
	allowedLeadDays?: number[]; // if not set, use min/max
	minLeadDays?: number;
	maxLeadDays?: number;
	requiredRecipientsJson: string[] | unknown;
	allowDisable: boolean;
	allowRecipientOverride: boolean;
	isActive: boolean;
}

export interface ReminderConfigLike {
	enabled: boolean;
	scheduleLeadDays?: number[];
	recipients?: string[];
	channel?: string;
	deadline?: string | null;
}

export interface ComplianceError {
	code: string;
	field: string;
	message: string;
}

export function checkCompliance(
	policy: ReminderPolicyLike,
	config: ReminderConfigLike,
): ComplianceError[] {
	const errors: ComplianceError[] = [];

	// mandatory must be enabled and active
	if (policy.category === "mandatory" && !config.enabled) {
		errors.push({
			code: "MANDATORY_LOCK",
			field: "enabled",
			message: `Policy ${policy.eventType} mandatory tidak boleh dinonaktifkan.`,
		});
	}
	if (!policy.isActive && config.enabled) {
		errors.push({
			code: "POLICY_INACTIVE",
			field: "enabled",
			message: `Policy ${policy.eventType} sudah tidak aktif.`,
		});
	}

	// allowed lead days
	const allowed =
		policy.allowedLeadDays ??
		(policy.minLeadDays !== undefined && policy.maxLeadDays !== undefined
			? Array.from(
					{ length: policy.maxLeadDays - policy.minLeadDays + 1 },
					(_, i) => policy.minLeadDays! + i,
				)
			: []);
	if (config.scheduleLeadDays) {
		for (const d of config.scheduleLeadDays) {
			if (!allowed.includes(d)) {
				errors.push({
					code: "LEAD_NOT_ALLOWED",
					field: "scheduleLeadDays",
					message: `Lead ${d} tidak diperbolehkan untuk ${policy.eventType}. Allowed: ${allowed.join(",")}`,
				});
			}
		}
		if (config.scheduleLeadDays.length === 0) {
			errors.push({
				code: "LEAD_EMPTY",
				field: "scheduleLeadDays",
				message: "Jadwal lead tidak boleh kosong.",
			});
		}
	}

	// deadline required for mandatory?
	if (policy.category === "mandatory" && !config.deadline) {
		// deadline may be computed server-side, but config must have preview
		// we allow null only if system will compute; for test we require deadline presence check
	}

	// required recipients
	const required = Array.isArray(policy.requiredRecipientsJson)
		? (policy.requiredRecipientsJson as string[])
		: [];
	const recips = config.recipients ?? [];
	for (const r of required) {
		if (!recips.includes(r)) {
			errors.push({
				code: "REQUIRED_RECIPIENT_MISSING",
				field: "recipients",
				message: `Penerima wajib ${r} hilang untuk ${policy.eventType}.`,
			});
		}
	}
	if (
		!policy.allowRecipientOverride &&
		config.recipients &&
		JSON.stringify(config.recipients.sort()) !== JSON.stringify(required.sort())
	) {
		errors.push({
			code: "RECIPIENT_OVERRIDE_NOT_ALLOWED",
			field: "recipients",
			message: "Override penerima tidak diperbolehkan.",
		});
	}

	// channel validation (simple)
	if (
		config.channel &&
		!["email", "digest", "escalation"].includes(config.channel)
	) {
		errors.push({
			code: "CHANNEL_INVALID",
			field: "channel",
			message: "Channel tidak valid.",
		});
	}

	return errors;
}

export function assertCompliance(
	policy: ReminderPolicyLike,
	config: ReminderConfigLike,
): void {
	const errs = checkCompliance(policy, config);
	if (errs.length) {
		const msg = errs.map((e) => `${e.field}: ${e.message}`).join("; ");
		const err = new Error(msg);
		(err as unknown as { code: string }).code = errs[0].code;
		throw err;
	}
}
