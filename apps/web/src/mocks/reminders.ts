export interface ReminderItem {
	id: string;
	event: string;
	category: "mandatory" | "recommended" | "optional";
	dueDate: string;
	scheduledLeadDays: number;
	recipients: string;
	channel: "email" | "digest";
	status: "scheduled" | "sent" | "locked";
}

export const mockReminders: ReminderItem[] = [
	{
		id: "rem-01",
		event: "Batas Penyelesaian Tagihan H+17 (K-001)",
		category: "mandatory",
		dueDate: "04 September 2026",
		scheduledLeadDays: 2,
		recipients: "operator.satker@kemenkeu.go.id, ppk@satker.go.id",
		channel: "email",
		status: "scheduled",
	},
	{
		id: "rem-02",
		event: "Konfirmasi Capaian Output Bulanan",
		category: "recommended",
		dueDate: "07 September 2026",
		scheduledLeadDays: 3,
		recipients: "operator.satker@kemenkeu.go.id",
		channel: "digest",
		status: "scheduled",
	},
];
