import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
	getMockWorkdayCalendar,
	type HolidayOverrideItem,
} from "@/mocks/workdays";
import {
	CalendarDays,
	CheckCircle2,
	Clock,
	Plus,
	Save,
	Upload,
} from "lucide-react";

export const Route = createFileRoute("/admin-kppn/policy/workdays")({
	component: AdminWorkdaysPage,
});

function AdminWorkdaysPage() {
	const calendar = getMockWorkdayCalendar();

	const [selectedMonth, setSelectedMonth] = useState<number>(8); // August
	const [selectedOverride, setSelectedOverride] = useState<HolidayOverrideItem>(
		{
			date: "2026-08-17",
			dayName: "Senin",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Hari Kemerdekaan Republik Indonesia Ke-81",
		},
	);
	const [overrides, setOverrides] = useState<HolidayOverrideItem[]>(
		calendar.overrides,
	);
	const [saveToast, setSaveToast] = useState<string | null>(null);

	// Impact preview interactive state
	const [bastDateInput, setBastDateInput] = useState("2026-08-12");

	// Days in month calculation for August (31 days, starting on Saturday)
	const daysInMonth = 31;
	const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

	const handleSaveOverride = () => {
		setOverrides((prev) => {
			const existingIndex = prev.findIndex(
				(o) => o.date === selectedOverride.date,
			);
			if (existingIndex >= 0) {
				const next = [...prev];
				next[existingIndex] = selectedOverride;
				return next;
			}
			return [...prev, selectedOverride];
		});

		setSaveToast(`Tanggal ${selectedOverride.date} berhasil diperbarui.`);
		setTimeout(() => setSaveToast(null), 4000);
	};

	return (
		<AdminShell currentPath="/admin-kppn/policy/workdays">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Kalender Hari Kerja ({calendar.year})
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Basis penentuan hari kerja untuk kalkulasi deadline H+17 Tagihan
							Kontraktual dan Capaian Output
						</p>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								alert(
									"Sinkronisasi kalender hari kerja dari SKB 3 Menteri resmi...",
								);
							}}
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
						>
							<Upload className="size-3.5" />
							<span>Import SKB Kalender</span>
						</button>

						<button
							type="button"
							onClick={() => {
								setSelectedOverride({
									date: "2026-08-28",
									dayName: "Jumat",
									status: "special_workday",
									statusLabel: "Hari Kerja Khusus",
									description: "Layanan Akhir Bulan KPPN",
								});
							}}
							className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs"
						>
							<Plus className="size-3.5" />
							<span>Tambah Override</span>
						</button>
					</div>
				</div>

				{/* Toast Alert */}
				{saveToast && (
					<div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-medium text-success">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-4 shrink-0" />
							<span>{saveToast}</span>
						</div>
						<button
							type="button"
							onClick={() => setSaveToast(null)}
							className="text-success hover:underline"
						>
							Tutup
						</button>
					</div>
				)}

				{/* Context Summary Cards */}
				<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
					<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Total Hari Kerja Efektif
						</span>
						<div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
							{calendar.totalWorkingDays} Hari
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Tahun Anggaran {calendar.year}
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Hari Libur &amp; Cuti Bersama
						</span>
						<div className="mt-2 text-2xl font-semibold tracking-tight text-primary">
							{overrides.length} Hari
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Tercatat dalam kalender versi {calendar.version}
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Sumber Regulasi Kalender
						</span>
						<div className="mt-2 text-sm font-semibold text-foreground line-clamp-1">
							SKB 3 Menteri 2026
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Terkunci ke Rule Set {calendar.ruleSetVersion}
						</p>
					</div>
				</div>

				{/* Main Calendar View & Date Editor Grid */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					{/* Left: Month View Calendar */}
					<div className="space-y-4 rounded-xl border border-border/80 bg-surface p-5 shadow-xs lg:col-span-7">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<CalendarDays className="size-4 text-primary" />
								<h3 className="text-sm font-semibold text-foreground">
									Kalender Bulan Agustus 2026
								</h3>
							</div>

							<div className="flex items-center gap-1">
								<select
									aria-label="Pilih bulan kalender kerja"
									value={selectedMonth}
									onChange={(e) =>
										setSelectedMonth(Number.parseInt(e.target.value, 10))
									}
									className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value={8}>Agustus 2026</option>
									<option value={9}>September 2026</option>
									<option value={10}>Oktober 2026</option>
									<option value={11}>November 2026</option>
									<option value={12}>Desember 2026</option>
								</select>
							</div>
						</div>

						{/* Day of Week Headers */}
						<div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
							<span>Sen</span>
							<span>Sel</span>
							<span>Rab</span>
							<span>Kam</span>
							<span>Jum</span>
							<span className="text-danger">Sab</span>
							<span className="text-danger">Min</span>
						</div>

						{/* Day Cells Grid */}
						<div className="grid grid-cols-7 gap-1 pt-1">
							{/* Empty cells before Saturday Aug 1 */}
							<div className="h-12 rounded-md bg-surface-muted/20" />
							<div className="h-12 rounded-md bg-surface-muted/20" />
							<div className="h-12 rounded-md bg-surface-muted/20" />
							<div className="h-12 rounded-md bg-surface-muted/20" />
							<div className="h-12 rounded-md bg-surface-muted/20" />

							{monthDays.map((day) => {
								const dateStr = `2026-08-${day.toString().padStart(2, "0")}`;
								const isHoliday = overrides.some(
									(o) => o.date === dateStr && o.status === "holiday",
								);
								const isSelected = selectedOverride.date === dateStr;

								return (
									<button
										key={day}
										type="button"
										onClick={() => {
											const found = overrides.find((o) => o.date === dateStr);
											if (found) {
												setSelectedOverride(found);
											} else {
												setSelectedOverride({
													date: dateStr,
													dayName: "Hari Kerja",
													status: "special_workday",
													statusLabel: "Hari Kerja",
													description: "Hari kerja operasional normal",
												});
											}
										}}
										className={`flex h-12 flex-col items-center justify-between rounded-lg border p-1 text-xs transition-all ${
											isSelected
												? "border-primary bg-primary/10 shadow-xs"
												: isHoliday
													? "border-danger/40 bg-danger/10 text-danger font-semibold"
													: "border-border/60 bg-background text-foreground hover:border-primary/40"
										}`}
									>
										<span>{day}</span>
										{isHoliday && (
											<span className="rounded bg-danger/20 px-1 text-[9px] font-semibold text-danger">
												Libur
											</span>
										)}
									</button>
								);
							})}
						</div>

						<div className="flex items-center gap-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
							<div className="flex items-center gap-1.5">
								<span className="size-2 rounded-full bg-danger" />
								<span>Hari Libur Nasional / Cuti</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="size-2 rounded-full bg-primary" />
								<span>Tanggal Terpilih</span>
							</div>
						</div>
					</div>

					{/* Right: Selected Date Detail Editor */}
					<div className="space-y-4 rounded-xl border border-border/80 bg-surface p-5 shadow-xs lg:col-span-5">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-semibold text-foreground">
								Detail Tanggal Override
							</h3>
							<span className="rounded bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground">
								{selectedOverride.date}
							</span>
						</div>

						<div className="space-y-3 text-xs">
							<div>
								<span className="text-muted-foreground block mb-1 font-medium">
									Tanggal:
								</span>
								<input
									aria-label="Tanggal override"
									type="date"
									value={selectedOverride.date}
									onChange={(e) =>
										setSelectedOverride({
											...selectedOverride,
											date: e.target.value,
										})
									}
									className="h-9 w-full rounded-lg border border-border bg-background px-3 font-semibold text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div>
								<span className="text-muted-foreground block mb-1 font-medium">
									Status Hari:
								</span>
								<select
									aria-label="Status hari"
									value={selectedOverride.status}
									onChange={(e) =>
										setSelectedOverride({
											...selectedOverride,
											status: e.target.value as
												| "holiday"
												| "joint_leave"
												| "special_workday",
											statusLabel:
												e.target.value === "holiday"
													? "Libur Nasional"
													: e.target.value === "joint_leave"
														? "Cuti Bersama"
														: "Hari Kerja Khusus",
										})
									}
									className="h-9 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
								>
									<option value="holiday">Hari Libur Nasional</option>
									<option value="joint_leave">Cuti Bersama</option>
									<option value="special_workday">Hari Kerja Khusus</option>
								</select>
							</div>

							<div>
								<span className="text-muted-foreground block mb-1 font-medium">
									Keterangan:
								</span>
								<textarea
									aria-label="Keterangan override tanggal"
									rows={3}
									value={selectedOverride.description}
									onChange={(e) =>
										setSelectedOverride({
											...selectedOverride,
											description: e.target.value,
										})
									}
									placeholder="Contoh: Hari Kemerdekaan RI..."
									className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<button
								type="button"
								onClick={handleSaveOverride}
								className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
							>
								<Save className="size-3.5" />
								<span>Simpan Override Tanggal</span>
							</button>
						</div>
					</div>
				</div>

				{/* Impact Calculator & Interactive Preview */}
				<div className="space-y-4 rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-2">
						<Clock className="size-4 text-primary" />
						<h3 className="text-sm font-semibold text-foreground">
							Simulator Dampak Perhitungan Deadline (H+17 Hari Kerja)
						</h3>
					</div>

					<p className="text-xs text-muted-foreground">
						Uji coba formula deadline SPM-LS secara langsung dengan memasukkan
						tanggal BAST/BAPP
					</p>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-lg border border-border/60 bg-background p-4 text-xs">
						<div>
							<span className="text-muted-foreground block mb-1 font-medium">
								Tanggal BAST / BAPP:
							</span>
							<input
								aria-label="Tanggal BAST atau BAPP"
								type="date"
								value={bastDateInput}
								onChange={(e) => setBastDateInput(e.target.value)}
								className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-semibold text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="space-y-1">
							<span className="text-muted-foreground block font-medium">
								Hari Libur yang Dilewati:
							</span>
							<div className="space-y-1 pt-1 text-[11px]">
								<p className="text-danger font-medium">
									• 17 Agu (Hari Kemerdekaan)
								</p>
								<p className="text-danger font-medium">
									• 25 Agu (Maulid Nabi SAW)
								</p>
							</div>
						</div>

						<div className="space-y-1 rounded-lg bg-primary/5 p-3 border border-primary/20">
							<span className="text-primary font-semibold">
								Batas Akhir SPM-LS (H+17 Kerja):
							</span>
							<div className="text-lg font-semibold text-foreground">
								04 September 2026
							</div>
							<p className="text-[11px] text-muted-foreground">
								(17 hari kerja + 8 hari weekend + 2 hari libur nasional = 27
								hari kalender)
							</p>
						</div>
					</div>
				</div>
			</div>
		</AdminShell>
	);
}
