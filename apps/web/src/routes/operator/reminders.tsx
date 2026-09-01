import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import {
	DomainDataTable,
	type ColumnDef,
} from "@/components/data/domain-data-table";
import { mockReminders, type ReminderItem } from "@/mocks/reminders";

export const Route = createFileRoute("/operator/reminders")({
	component: OperatorRemindersPage,
});

function OperatorRemindersPage() {
	const data = mockReminders;
	const [search, setSearch] = useState("");

	const filteredData = data.filter(
		(item) =>
			item.event.toLowerCase().includes(search.toLowerCase()) ||
			item.recipients.toLowerCase().includes(search.toLowerCase()),
	);

	const columns: ColumnDef<ReminderItem>[] = [
		{
			key: "event",
			header: "Event Pengingat Tenggat",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">{item.event}</span>
					<p className="text-[11px] text-muted-foreground">
						Jatuh Tempo: {item.dueDate}
					</p>
				</div>
			),
		},
		{
			key: "category",
			header: "Kategori Policy",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.category === "mandatory"
							? "bg-danger/10 text-danger"
							: "bg-primary/10 text-primary"
					}`}
				>
					{item.category === "mandatory"
						? "Mandatory (Terkunci)"
						: "Recommended"}
				</span>
			),
		},
		{
			key: "lead",
			header: "Jadwal Lead Time",
			render: (item) => `H-${item.scheduledLeadDays} Hari Kerja`,
		},
		{
			key: "recipients",
			header: "Penerima Email Notifikasi",
			render: (item) => (
				<span className="text-[11px] text-muted-foreground">
					{item.recipients}
				</span>
			),
		},
		{
			key: "status",
			header: "Status Delivery",
			render: (item) => (
				<span className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
					{item.status === "scheduled" ? "Dijadwalkan" : "Terkirim"}
				</span>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/reminders">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Reminder Center — Jadwal & Notifikasi Tenggat
						</h1>
						<p className="text-xs text-muted-foreground">
							Kelola pengaturan notifikasi pengingat sebelum batas jatuh tempo
							IKPA sesuai kebijakan Compliance Guard KPPN.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() =>
								alert("Pengaturan reminder direset ke default policy.")
							}
							className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
						>
							Reset ke Default Policy
						</button>
					</div>
				</div>

				<DomainDataTable
					title="Daftar Pengingat Aktif"
					data={filteredData}
					columns={columns}
					searchValue={search}
					onSearchChange={setSearch}
					onAddClick={() => alert("Menambah konfigurasi reminder baru.")}
					totalCount={filteredData.length}
				/>
			</div>
		</OperatorShell>
	);
}
