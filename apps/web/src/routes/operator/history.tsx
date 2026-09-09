import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	ExternalLink,
	Eye,
	GitCompare,
	Pencil,
	Scale,
	Search,
	Trash2,
	X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatNumber, formatPointDelta } from "@/lib/format";
import { resolveIndicatorRoute } from "@/lib/indicator-routes";
import {
	type ActualSnapshotItem,
	type HistoryPageData,
	type SavedScenarioItem,
	deleteScenario,
	fetchHistoryData,
	updateScenario,
} from "@/services/simulation-service";

export const Route = createFileRoute("/operator/history")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		try {
			return await fetchHistoryData(activeOrgId);
		} catch {
			return {
				actualSnapshots: [],
				savedScenarios: [],
				snapshots: [],
			};
		}
	},
	component: OperatorHistoryPage,
});

type TabType = "snapshots" | "scenarios" | "compare";

const INDICATOR_CANONICAL_ORDER = [
	{ key: "dipa_revision", label: "Revisi DIPA", weight: 10 },
	{ key: "rpd_deviation", label: "Deviasi Halaman III", weight: 15 },
	{ key: "budget_absorption", label: "Penyerapan Anggaran", weight: 20 },
	{ key: "contractual", label: "Belanja Kontraktual", weight: 10 },
	{ key: "invoice_timeliness", label: "Penyelesaian Tagihan", weight: 10 },
	{ key: "up_tup", label: "UP/TUP & KKP", weight: 10 },
	{ key: "output_achievement", label: "Capaian Output", weight: 25 },
	{ key: "spm_dispensasi", label: "Dispensasi SPM", weight: 0, isDeduction: true },
];

const MONTH_NAMES = [
	"Januari",
	"Februari",
	"Maret",
	"April",
	"Mei",
	"Juni",
	"Juli",
	"Agustus",
	"September",
	"Oktober",
	"November",
	"Desember",
];

function extractBreakdownMap(breakdownJson: unknown): Map<string, { rawScore: number; contrib: number }> {
	const map = new Map<string, { rawScore: number; contrib: number }>();
	if (!breakdownJson || typeof breakdownJson !== "object") return map;

	const b = breakdownJson as {
		indicators?: Array<{ key: string; score?: string | null; weightedContribution?: string | null }>;
		dispensationDeduction?: string | null;
	};

	if (b.indicators && Array.isArray(b.indicators)) {
		for (const ind of b.indicators) {
			const raw = ind.score !== null && ind.score !== undefined ? parseFloat(ind.score) : 0;
			const contrib = ind.weightedContribution !== null && ind.weightedContribution !== undefined
				? parseFloat(ind.weightedContribution)
				: 0;
			map.set(ind.key, { rawScore: raw, contrib });
		}
	}

	if (b.dispensationDeduction !== undefined && b.dispensationDeduction !== null) {
		const raw = parseFloat(b.dispensationDeduction) || 0;
		map.set("spm_dispensasi", { rawScore: raw, contrib: -raw });
	}

	return map;
}

function OperatorHistoryPage() {
	const data: HistoryPageData = Route.useLoaderData();
	const router = useRouter();
	const navigate = useNavigate();

	const [activeTab, setActiveTab] = useState<TabType>("snapshots");
	const [search, setSearch] = useState("");
	const [selectedPeriod, setSelectedPeriod] = useState<number | "all">("all");

	// Selection for comparison (holds item IDs: snapshotId or scenarioId)
	const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

	// Inspect detail modal state
	const [inspectItem, setInspectItem] = useState<ActualSnapshotItem | SavedScenarioItem | null>(null);

	// Deletion state
	const [deletingScenario, setDeletingScenario] = useState<SavedScenarioItem | null>(null);
	const [isProcessingDelete, setIsProcessingDelete] = useState(false);

	// Editing scenario state
	const [editingScenario, setEditingScenario] = useState<SavedScenarioItem | null>(null);
	const [editScenarioName, setEditScenarioName] = useState("");
	const [editTargetScore, setEditTargetScore] = useState("95.00");
	const [editIndicatorScores, setEditIndicatorScores] = useState<Record<string, number>>({
		dipa_revision: 100,
		rpd_deviation: 100,
		absorption: 100,
		contractual: 100,
		invoice_timeliness: 100,
		up_tup: 100,
		output_achievement: 100,
		spm_dispensation: 100,
	});
	const [isSavingEdit, setIsSavingEdit] = useState(false);

	const handleOpenEdit = (sc: SavedScenarioItem) => {
		setEditingScenario(sc);
		setEditScenarioName(sc.name);
		setEditTargetScore(sc.targetScore ? String(sc.targetScore) : "95.00");
		const breakdownMap = extractBreakdownMap(sc.breakdownJson);
		const initialScores: Record<string, number> = {};
		for (const ind of INDICATOR_CANONICAL_ORDER) {
			const item = breakdownMap.get(ind.key);
			initialScores[ind.key] = item ? item.rawScore : 100;
		}
		setEditIndicatorScores(initialScores);
	};

	const editCalculatedTotal = useMemo(() => {
		let sum = 0;
		for (const ind of INDICATOR_CANONICAL_ORDER) {
			const raw = editIndicatorScores[ind.key] ?? 100;
			sum += (raw * ind.weight) / 100;
		}
		return sum;
	}, [editIndicatorScores]);

	const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// 12-Month structured matrix of actual snapshots (Januari s.d. Desember)
	const twelveMonthsList = useMemo(() => {
		return Array.from({ length: 12 }, (_, idx) => {
			const month = idx + 1;
			const snap = data.actualSnapshots.find((s) => s.month === month);
			return {
				month,
				monthName: MONTH_NAMES[idx],
				snapshot: snap || null,
			};
		});
	}, [data.actualSnapshots]);

	const filteredMonthlyList = useMemo(() => {
		return twelveMonthsList.filter((m) => {
			const matchPeriod = selectedPeriod === "all" || m.month === selectedPeriod;
			const matchSearch =
				search === "" ||
				m.monthName.toLowerCase().includes(search.toLowerCase()) ||
				(m.snapshot?.ruleSetVersion &&
					m.snapshot.ruleSetVersion.toLowerCase().includes(search.toLowerCase()));
			return matchPeriod && matchSearch;
		});
	}, [twelveMonthsList, selectedPeriod, search]);

	// 3-Slot scenario system (Skenario A, Skenario B, Skenario C)
	const scenarioSlots = useMemo(() => {
		const slots: Array<{
			slot: "A" | "B" | "C";
			label: string;
			color: "blue" | "purple" | "amber";
			scenario: SavedScenarioItem | null;
		}> = [
			{ slot: "A", label: "Skenario A", color: "blue", scenario: null },
			{ slot: "B", label: "Skenario B", color: "purple", scenario: null },
			{ slot: "C", label: "Skenario C", color: "amber", scenario: null },
		];

		for (const sc of data.savedScenarios) {
			const nameUpper = sc.name.toUpperCase();
			if (nameUpper.includes("SKENARIO A") || nameUpper.startsWith("[A]") || nameUpper.startsWith("A:")) {
				if (!slots[0].scenario) slots[0].scenario = sc;
			} else if (nameUpper.includes("SKENARIO B") || nameUpper.startsWith("[B]") || nameUpper.startsWith("B:")) {
				if (!slots[1].scenario) slots[1].scenario = sc;
			} else if (nameUpper.includes("SKENARIO C") || nameUpper.startsWith("[C]") || nameUpper.startsWith("C:")) {
				if (!slots[2].scenario) slots[2].scenario = sc;
			} else {
				const empty = slots.find((s) => s.scenario === null);
				if (empty) empty.scenario = sc;
			}
		}

		return slots;
	}, [data.savedScenarios]);

	// All selectable items map for comparison
	const allItemsMap = useMemo(() => {
		const map = new Map<string, {
			id: string;
			name: string;
			type: "actual" | "scenario";
			totalScore: number | null;
			targetScore: number;
			periodLabel: string;
			ruleSetVersion: string;
			createdAt: string;
			overrides?: Record<string, unknown>[];
			breakdownJson: unknown;
		}>();

		for (const s of data.actualSnapshots) {
			map.set(s.id, {
				id: s.id,
				name: `Snapshot ${MONTH_NAMES[s.month - 1] || `Bulan ${s.month}`}`,
				type: "actual",
				totalScore: s.totalScore,
				targetScore: s.targetScore,
				periodLabel: MONTH_NAMES[s.month - 1] || `Bulan ${s.month}`,
				ruleSetVersion: s.ruleSetVersion,
				createdAt: s.createdAt,
				breakdownJson: s.breakdownJson,
			});
		}

		for (const sc of data.savedScenarios) {
			map.set(sc.id, {
				id: sc.id,
				name: sc.name,
				type: "scenario",
				totalScore: sc.totalScore,
				targetScore: sc.targetScore,
				periodLabel: MONTH_NAMES[sc.month - 1] || `Bulan ${sc.month}`,
				ruleSetVersion: sc.ruleSetVersion,
				createdAt: sc.createdAt,
				overrides: sc.overrides as unknown as Record<string, unknown>[],
				breakdownJson: sc.breakdownJson,
			});
		}

		return map;
	}, [data]);

	const toggleSelectForCompare = (id: string) => {
		setSelectedItemIds((prev) => {
			if (prev.includes(id)) {
				return prev.filter((i) => i !== id);
			}
			if (prev.length >= 3) {
				return [prev[1], prev[2], id];
			}
			return [...prev, id];
		});
	};

	const selectedCompareItems = useMemo(() => {
		return selectedItemIds
			.map((id) => allItemsMap.get(id))
			.filter((item): item is NonNullable<typeof item> => Boolean(item));
	}, [selectedItemIds, allItemsMap]);

	// Check if compared items have different rule set versions
	const hasRuleSetMismatch = useMemo(() => {
		if (selectedCompareItems.length < 2) return false;
		const firstVersion = selectedCompareItems[0].ruleSetVersion;
		return selectedCompareItems.some((i) => i.ruleSetVersion !== firstVersion);
	}, [selectedCompareItems]);

	const handleDeleteConfirm = async () => {
		if (!deletingScenario) return;
		setIsProcessingDelete(true);
		setFeedbackMessage(null);
		setErrorMessage(null);
		try {
			await deleteScenario(deletingScenario.id);
			setFeedbackMessage(`Skenario "${deletingScenario.name}" berhasil dihapus.`);
			setDeletingScenario(null);
			await router.invalidate();
			setTimeout(() => setFeedbackMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(err instanceof Error ? err.message : "Gagal menghapus skenario.");
		} finally {
			setIsProcessingDelete(false);
		}
	};

	const handleSaveEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingScenario) return;
		setIsSavingEdit(true);
		setFeedbackMessage(null);
		setErrorMessage(null);
		try {
			const normalizedTarget = editTargetScore.replace(",", ".").trim();
			const targetNum = parseFloat(normalizedTarget);
			await updateScenario(editingScenario.id, {
				name: editScenarioName,
				targetScore: Number.isFinite(targetNum)
					? String(Math.min(Math.max(targetNum, 0), 100))
					: editTargetScore,
				indicatorScores: editIndicatorScores,
			});
			setFeedbackMessage(`Skenario "${editScenarioName}" berhasil diperbarui.`);
			setEditingScenario(null);
			await router.invalidate();
			setTimeout(() => setFeedbackMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(err instanceof Error ? err.message : "Gagal memperbarui skenario.");
		} finally {
			setIsSavingEdit(false);
		}
	};

	return (
		<OperatorShell currentPath="/operator/history">
			<div className="space-y-6">
				{/* Top Clean Tab Toolbar */}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1 border border-border/80">
						<button
							type="button"
							onClick={() => setActiveTab("snapshots")}
							className={twMerge(
								"rounded-lg px-3 py-1.5 text-xs font-semibold transition",
								activeTab === "snapshots"
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							Evaluasi Bulanan (12 Bulan)
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("scenarios")}
							className={twMerge(
								"rounded-lg px-3 py-1.5 text-xs font-semibold transition",
								activeTab === "scenarios"
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							Skenario Simulasi (Slot A, B, C)
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("compare")}
							className={twMerge(
								"flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
								activeTab === "compare"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<GitCompare className="size-3.5" />
							<span>Bandingkan</span>
							{selectedItemIds.length > 0 && (
								<span className="ml-0.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[10px] font-bold">
									{selectedItemIds.length}
								</span>
							)}
						</button>
					</div>
				</div>

				{/* Feedback Alerts */}
				{feedbackMessage && (
					<output className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<CheckCircle2 className="size-4 shrink-0" />
						<p>{feedbackMessage}</p>
					</output>
				)}

				{errorMessage && (
					<div
						role="alert"
						className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs"
					>
						<AlertCircle className="size-4 shrink-0" />
						<p>{errorMessage}</p>
					</div>
				)}

				{/* Search & Filter Toolbar (for Tab 1 & 2) */}
				{activeTab !== "compare" && (
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="relative flex-1 max-w-md">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="text"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Cari berdasarkan nama atau indikator..."
								className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<div className="flex items-center gap-2">
							<label htmlFor="period-filter" className="text-xs font-medium text-muted-foreground">
								Periode:
							</label>
							<select
								id="period-filter"
								value={selectedPeriod}
								onChange={(e) =>
									setSelectedPeriod(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))
								}
								aria-label="Filter Periode"
								className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Periode</option>
								{MONTH_NAMES.map((m, idx) => (
									<option key={m} value={idx + 1}>
										{m}
									</option>
								))}
							</select>
						</div>
					</div>
				)}

				{/* TAB 1: EVALUASI BULANAN (Matriks 12 Bulan TA 2026) */}
				{activeTab === "snapshots" && (
					<div className="space-y-4">
						<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-surface p-3.5 border border-border text-xs">
							<div>
								<span className="font-bold text-foreground">
									Evaluasi Kinerja Aktual 12 Bulan (Tahun Anggaran 2026)
								</span>
								<p className="text-[11px] text-muted-foreground">
									Rekapitulasi nilai IKPA kumulatif per akhir bulan evaluasi (YTD). Data bersih, akurat, dan sinkron dengan kalkulasi resmi.
								</p>
							</div>
							<span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
								12 Periode Evaluasi
							</span>
						</div>

						<div className="overflow-x-auto rounded-2xl border border-border bg-background shadow-xs">
							<table className="w-full text-left text-xs">
								<thead className="border-b border-border/80 bg-surface-muted/60 text-muted-foreground">
									<tr>
										<th className="px-4 py-3 font-semibold text-center w-12">Pilih</th>
										<th className="px-4 py-3 font-semibold">Bulan Evaluasi</th>
										<th className="px-4 py-3 font-semibold">Nilai Total IKPA</th>
										<th className="px-4 py-3 font-semibold">Target &amp; Gap</th>
										<th className="px-4 py-3 font-semibold">Status Data</th>
										<th className="px-4 py-3 font-semibold">Rule Set</th>
										<th className="px-4 py-3 font-semibold">Terakhir Dihitung</th>
										<th className="px-4 py-3 font-semibold text-right">Aksi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/60 text-foreground">
									{filteredMonthlyList.map((m) => {
										const s = m.snapshot;
										const isEvaluated = s !== null && s.totalScore !== null;
										const isSelected = s ? selectedItemIds.includes(s.id) : false;

										return (
											<tr
												key={m.month}
												className={twMerge(
													"transition hover:bg-surface-muted/40",
													isSelected && "bg-primary/[0.03]",
													!isEvaluated && "opacity-75",
												)}
											>
												<td className="px-4 py-3 text-center">
													{isEvaluated && s ? (
														<input
															type="checkbox"
															checked={isSelected}
															onChange={() => toggleSelectForCompare(s.id)}
															aria-label={`Pilih Bulan ${m.monthName}`}
															className="size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
														/>
													) : (
														<span className="text-muted-foreground/40">—</span>
													)}
												</td>
												<td className="px-4 py-3 font-semibold">
													<div>
														<span className="text-foreground">
															Bulan {m.month} — {m.monthName}
														</span>
														<p className="text-[11px] text-muted-foreground font-normal">
															Akumulasi s.d. 30/31 {m.monthName} 2026
														</p>
													</div>
												</td>
												<td className="px-4 py-3 font-bold text-sm">
													{isEvaluated && s?.totalScore !== null ? (
														<span className="text-foreground font-extrabold text-primary">
															{formatNumber(s.totalScore)}
														</span>
													) : (
														<span className="text-muted-foreground font-normal">—</span>
													)}
												</td>
												<td className="px-4 py-3">
													{isEvaluated && s ? (
														<>
															<span className="text-muted-foreground">
																{formatNumber(s.targetScore)}
															</span>
															<span
																className={twMerge(
																	"ml-1.5 font-semibold",
																	s.gapScore !== null && s.gapScore >= 0
																		? "text-success"
																		: "text-danger",
																)}
															>
																({s.gapScore !== null ? formatPointDelta(s.gapScore) : "—"})
															</span>
														</>
													) : (
														<span className="text-muted-foreground">95,00</span>
													)}
												</td>
												<td className="px-4 py-3">
													{isEvaluated ? (
														<span className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
															Lengkap (YTD)
														</span>
													) : (
														<span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
															Belum Terevaluasi
														</span>
													)}
												</td>
												<td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
													{s?.ruleSetVersion || "2026.1"}
												</td>
												<td className="px-4 py-3 text-muted-foreground text-[11px]">
													{s?.createdAt ? (
														new Date(s.createdAt).toLocaleDateString("id-ID", {
															day: "numeric",
															month: "short",
															year: "numeric",
															hour: "2-digit",
															minute: "2-digit",
														})
													) : (
														"—"
													)}
												</td>
												<td className="px-4 py-3 text-right">
													{isEvaluated && s ? (
														<div className="flex items-center justify-end gap-1.5">
															<button
																type="button"
																onClick={() => setInspectItem(s)}
																className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
															>
																<Eye className="inline size-3.5 mr-1" />
																Detail
															</button>
															<button
																type="button"
																onClick={() => {
																	toggleSelectForCompare(s.id);
																	setActiveTab("compare");
																}}
																className="rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
															>
																Bandingkan
															</button>
														</div>
													) : (
														<button
															type="button"
															onClick={() => navigate({ to: "/operator/dashboard" as never })}
															className="rounded-lg border border-border/70 bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition"
														>
															Hitung di Dashboard →
														</button>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* TAB 2: SKENARIO TERSIMPAN (Sistem 3 Slot: Skenario A, B, C) */}
				{activeTab === "scenarios" && (
					<div className="space-y-4">
						{/* Slot Overview Banner */}
						<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-surface p-3.5 border border-border text-xs">
							<div>
								<span className="font-bold text-foreground">
									Skenario Simulasi What-If (Slot A, B, dan C)
								</span>
								<p className="text-[11px] text-muted-foreground">
									Slot skenario What-If lokal yang siap diedit, dibandingkan, atau ditimpa (rewrite) langsung dari simulasi indikator.
								</p>
							</div>
							<span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
								Maks. 3 Skenario
							</span>
						</div>

						{/* 3 Scenario Cards Grid */}
						<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
							{scenarioSlots.map((item) => {
								const sc = item.scenario;
								const isSelected = sc ? selectedItemIds.includes(sc.id) : false;

								if (!sc) {
									return (
										<div
											key={item.slot}
											className="flex flex-col justify-between rounded-2xl border border-dashed border-border bg-background p-5 text-center shadow-xs"
										>
											<div>
												<div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground font-bold">
													{item.slot}
												</div>
												<h3 className="mt-3 text-sm font-bold text-foreground">
													{item.label} (Kosong)
												</h3>
												<p className="mt-1 text-xs text-muted-foreground">
													Belum ada simulasi What-If yang disimpan di slot ini.
												</p>
											</div>

											<div className="mt-5 space-y-1.5 border-t border-border/60 pt-4 text-left">
												<p className="text-[11px] font-semibold text-muted-foreground">
													Uji coba What-If dari menu:
												</p>
												<div className="grid grid-cols-2 gap-1.5">
													<button
														type="button"
														onClick={() => navigate({ to: "/operator/deviasi" as never })}
														className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted text-center transition"
													>
														Deviasi Hal III
													</button>
													<button
														type="button"
														onClick={() => navigate({ to: "/operator/penyerapan" as never })}
														className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted text-center transition"
													>
														Penyerapan
													</button>
													<button
														type="button"
														onClick={() => navigate({ to: "/operator/up-tup" as never })}
														className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted text-center transition"
													>
														UP/TUP &amp; KKP
													</button>
													<button
														type="button"
														onClick={() => navigate({ to: "/operator/data/output-achievement" as never })}
														className="rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted text-center transition"
													>
														Capaian Output
													</button>
												</div>
											</div>
										</div>
									);
								}

								return (
									<div
										key={item.slot}
										className={twMerge(
											"flex flex-col justify-between rounded-2xl border bg-background p-5 shadow-xs transition hover:shadow-sm",
											isSelected ? "border-primary ring-1 ring-primary/40 bg-primary/[0.01]" : "border-border",
										)}
									>
										<div className="space-y-3">
											<div className="flex items-center justify-between">
												<span
													className={twMerge(
														"rounded-md px-2.5 py-0.5 text-xs font-bold",
														item.slot === "A" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
														item.slot === "B" && "bg-purple-500/10 text-purple-600 dark:text-purple-400",
														item.slot === "C" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
													)}
												>
													Slot {item.slot}
												</span>
												<span className="text-[11px] text-muted-foreground font-medium">
													{MONTH_NAMES[sc.month - 1] || `Bulan ${sc.month}`} 2026
												</span>
											</div>

											<div>
												<h4 className="text-sm font-bold text-foreground">
													{sc.name}
												</h4>
												<p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
													{sc.overridesCount} asumsi diubah · Rule set {sc.ruleSetVersion}
												</p>
											</div>

											{/* Score Box */}
											<div className="rounded-xl border border-border/80 bg-surface p-3">
												<div className="flex items-baseline justify-between">
													<span className="text-[11px] text-muted-foreground font-medium">
														Hasil Estimasi IKPA:
													</span>
													<strong className="text-base font-bold text-foreground">
														{sc.totalScore !== null ? formatNumber(sc.totalScore) : "—"}
													</strong>
												</div>
												{sc.deltaFromBaseline !== null && sc.deltaFromBaseline !== undefined && (
													<p className="mt-1 text-[11px] font-semibold text-success">
														▲ {sc.deltaFromBaseline >= 0 ? "+" : ""}
														{formatNumber(sc.deltaFromBaseline)} pts vs baseline aktual
													</p>
												)}
											</div>

											{/* Impacted Indicators */}
											<div className="space-y-1">
												<span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
													Indikator Terdampak:
												</span>
												<div className="flex flex-wrap gap-1">
													{sc.impactedIndicators.length > 0 ? (
														sc.impactedIndicators.map((indKey) => {
															const info = resolveIndicatorRoute(indKey);
															return (
																<span
																	key={indKey}
																	className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
																>
																	{info?.label || indKey}
																</span>
															);
														})
													) : (
														<span className="text-[11px] text-muted-foreground">
															Asumsi Terbobot
														</span>
													)}
												</div>
											</div>
										</div>

										{/* Card Footer Actions */}
										<div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between gap-1.5">
											<div className="flex items-center gap-1.5">
												<button
													type="button"
													onClick={() => handleOpenEdit(sc)}
													title="Ubah Nama, Target & Nilai Indikator"
													className="rounded-lg border border-border bg-surface p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 hover:border-primary/30 transition"
												>
													<Pencil className="size-4" />
												</button>
												<button
													type="button"
													onClick={() => setInspectItem(sc)}
													title="Lihat Detail Skenario"
													className="rounded-lg border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
												>
													<Eye className="size-4" />
												</button>
												<button
													type="button"
													onClick={() => setDeletingScenario(sc)}
													title="Hapus / Kosongkan Slot"
													className="rounded-lg border border-border bg-surface p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 hover:border-danger/30 transition"
												>
													<Trash2 className="size-4" />
												</button>
											</div>

											<button
												type="button"
												onClick={() => {
													toggleSelectForCompare(sc.id);
													setActiveTab("compare");
												}}
												className={twMerge(
													"flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
													isSelected
														? "bg-primary text-primary-foreground"
														: "bg-primary/10 text-primary hover:bg-primary/20",
												)}
											>
												<GitCompare className="size-3.5" />
												<span>{isSelected ? "Terpilih" : "Bandingkan"}</span>
											</button>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{/* TAB 3: BANDINGKAN */}
				{activeTab === "compare" && (
					<div className="space-y-6">
						{/* Item Selection Pills */}
						<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-3">
								<div>
									<h3 className="text-sm font-bold text-foreground sm:text-base flex items-center gap-2">
										<Scale className="size-4 text-primary" />
										<span>Pilih Item Perbandingan (2 s.d. 3 Item)</span>
									</h3>
									<p className="text-xs text-muted-foreground">
										Pilih snapshot aktual atau skenario untuk melihat komparasi detail 8 indikator.
									</p>
								</div>
								{selectedItemIds.length > 0 && (
									<button
										type="button"
										onClick={() => setSelectedItemIds([])}
										className="self-start sm:self-auto text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
									>
										Reset Pilihan
									</button>
								)}
							</div>

							<div className="mt-3 flex flex-wrap gap-2">
								{Array.from(allItemsMap.values()).map((item) => {
									const isChecked = selectedItemIds.includes(item.id);
									return (
										<button
											key={item.id}
											type="button"
											onClick={() => toggleSelectForCompare(item.id)}
											className={twMerge(
												"inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
												isChecked
													? "border-primary bg-primary text-primary-foreground shadow-xs"
													: "border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground",
											)}
										>
											<span>{item.type === "actual" ? "📸" : "🧪"}</span>
											<span>{item.name}</span>
											<span className="text-[10px] opacity-80">
												({item.totalScore !== null ? formatNumber(item.totalScore) : "—"})
											</span>
										</button>
									);
								})}
							</div>
						</div>

						{/* Rule Set Mismatch Warning */}
						{hasRuleSetMismatch && (
							<div className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-xs font-semibold text-warning-foreground shadow-xs">
								<AlertTriangle className="size-5 shrink-0 text-warning" />
								<div>
									<p className="font-bold">Peringatan: Versi Rule Set Berbeda</p>
									<p className="text-[11px] opacity-90 font-normal">
										Item yang Anda bandingkan dihitung menggunakan versi rule set yang berbeda. Nilai komparasi mungkin merefleksikan perubahan formulasi regulasi.
									</p>
								</div>
							</div>
						)}

						{/* Comparison Table / Empty State */}
						{selectedCompareItems.length < 2 ? (
							<div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center shadow-xs">
								<Scale className="mx-auto size-10 text-muted-foreground/50" />
								<h3 className="mt-3 text-sm font-bold text-foreground">
									Pilih Minimal 2 Item untuk Dibandingkan
								</h3>
								<p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
									Silakan pilih 2 atau 3 snapshot/skenario dari tombol di atas untuk melihat perbandingan skor total dan rincian 8 indikator IKPA secara berdampingan.
								</p>
							</div>
						) : (
							<div className="space-y-6">
								{/* Total Summary Cards Grid */}
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
									{selectedCompareItems.map((item, idx) => {
										const isBaseline = idx === 0;
										const baselineScore = selectedCompareItems[0].totalScore ?? 0;
										const deltaFromBaseline =
											item.totalScore !== null && !isBaseline
												? item.totalScore - baselineScore
												: null;

										return (
											<div
												key={item.id}
												className={twMerge(
													"rounded-2xl border p-5 shadow-xs transition",
													isBaseline
														? "border-primary/40 bg-primary/[0.02]"
														: "border-border bg-background",
												)}
											>
												<div className="flex items-center justify-between">
													<span
														className={twMerge(
															"rounded-md px-2 py-0.5 text-[11px] font-semibold",
															isBaseline
																? "bg-primary/10 text-primary"
																: "bg-surface-muted text-muted-foreground",
														)}
													>
														{isBaseline ? "Item 1 (Baseline)" : `Item ${idx + 1}`}
													</span>
													<span className="text-[11px] text-muted-foreground">
														{item.periodLabel}
													</span>
												</div>

												<h4 className="mt-2 text-sm font-bold text-foreground line-clamp-1">
													{item.name}
												</h4>

												<div className="mt-4 flex items-baseline justify-between border-t border-border/60 pt-3">
													<div>
														<span className="text-[11px] text-muted-foreground">
															Nilai IKPA
														</span>
														<p className="text-2xl font-bold text-foreground">
															{item.totalScore !== null
																? formatNumber(item.totalScore)
																: "—"}
														</p>
													</div>

													{!isBaseline && deltaFromBaseline !== null && (
														<div className="text-right">
															<span className="text-[11px] text-muted-foreground">
																Δ vs Baseline
															</span>
															<p
																className={twMerge(
																	"text-sm font-bold",
																	deltaFromBaseline >= 0
																		? "text-success"
																		: "text-danger",
																)}
															>
																{deltaFromBaseline >= 0 ? "+" : ""}
																{formatNumber(deltaFromBaseline)} pts
															</p>
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>

								{/* 8 Indicators Breakdown Comparison Table */}
								<div className="overflow-x-auto rounded-2xl border border-border bg-background shadow-xs">
									<table className="w-full text-left text-xs">
										<thead className="border-b border-border/80 bg-surface-muted/60 text-muted-foreground">
											<tr>
												<th className="px-4 py-3 font-semibold">Indikator IKPA</th>
												<th className="px-4 py-3 font-semibold">Bobot</th>
												{selectedCompareItems.map((item, idx) => (
													<th key={item.id} className="px-4 py-3 font-semibold">
														{idx === 0 ? "1. Baseline" : `${idx + 1}. ${item.name}`}
													</th>
												))}
												{selectedCompareItems.length > 1 && (
													<th className="px-4 py-3 font-semibold text-right">
														Δ (Item 2 vs 1)
													</th>
												)}
												{selectedCompareItems.length > 2 && (
													<th className="px-4 py-3 font-semibold text-right">
														Δ (Item 3 vs 1)
													</th>
												)}
											</tr>
										</thead>
										<tbody className="divide-y divide-border/60 text-foreground">
											{INDICATOR_CANONICAL_ORDER.map((ind) => {
												const b1 = extractBreakdownMap(selectedCompareItems[0]?.breakdownJson).get(ind.key);
												const b2 = extractBreakdownMap(selectedCompareItems[1]?.breakdownJson).get(ind.key);
												const b3 = selectedCompareItems[2]
													? extractBreakdownMap(selectedCompareItems[2].breakdownJson).get(ind.key)
													: null;

												const score1 = b1?.rawScore ?? 0;
												const score2 = b2?.rawScore ?? 0;
												const score3 = b3?.rawScore ?? 0;

												const delta2vs1 = score2 - score1;
												const delta3vs1 = b3 ? score3 - score1 : null;

												return (
													<tr key={ind.key} className="transition hover:bg-surface-muted/30">
														<td className="px-4 py-3 font-semibold">
															{ind.label}
															{ind.isDeduction && (
																<span className="ml-1.5 rounded bg-danger/10 px-1.5 py-0.2 text-[10px] font-bold text-danger">
																	pengurang
																</span>
															)}
														</td>
														<td className="px-4 py-3 text-muted-foreground">
															{ind.isDeduction ? "—" : `${ind.weight}%`}
														</td>
														<td className="px-4 py-3 font-medium">
															{formatNumber(score1)}
															<span className="text-[10px] text-muted-foreground ml-1">
																({formatNumber(b1?.contrib ?? 0)} pts)
															</span>
														</td>
														<td className="px-4 py-3 font-medium">
															{formatNumber(score2)}
															<span className="text-[10px] text-muted-foreground ml-1">
																({formatNumber(b2?.contrib ?? 0)} pts)
															</span>
														</td>
														{selectedCompareItems.length > 2 && (
															<td className="px-4 py-3 font-medium">
																{formatNumber(score3)}
																<span className="text-[10px] text-muted-foreground ml-1">
																	({formatNumber(b3?.contrib ?? 0)} pts)
																</span>
															</td>
														)}
														<td className="px-4 py-3 text-right">
															<span
																className={twMerge(
																	"font-bold",
																	delta2vs1 >= 0 ? "text-success" : "text-danger",
																)}
															>
																{delta2vs1 >= 0 ? "+" : ""}
																{formatNumber(delta2vs1)}
															</span>
														</td>
														{selectedCompareItems.length > 2 && delta3vs1 !== null && (
															<td className="px-4 py-3 text-right">
																<span
																	className={twMerge(
																		"font-bold",
																		delta3vs1 >= 0 ? "text-success" : "text-danger",
																	)}
																>
																	{delta3vs1 >= 0 ? "+" : ""}
																	{formatNumber(delta3vs1)}
																</span>
															</td>
														)}
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
						)}
					</div>
				)}

				{/* INSPECT DETAIL MODAL */}
				<Dialog.Root open={Boolean(inspectItem)} onOpenChange={(open) => !open && setInspectItem(null)}>
					<Dialog.Portal>
						<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs" />
						<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-2xl outline-none max-h-[85dvh] overflow-y-auto">
							{inspectItem && (() => {
								const isScenario = "impactedIndicators" in inspectItem;
								const breakdownMap = extractBreakdownMap(inspectItem.breakdownJson);

								return (
									<div className="space-y-5">
										<div className="flex items-center justify-between border-b border-border/80 pb-3">
											<div>
												<span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
													{isScenario ? "Skenario Tersimpan" : "Snapshot Aktual"}
												</span>
												<Dialog.Title className="mt-1 text-base font-bold text-foreground sm:text-lg">
													{"name" in inspectItem ? inspectItem.name : inspectItem.simulationName}
												</Dialog.Title>
											</div>
											<Dialog.Close asChild>
												<button
													type="button"
													className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
												>
													<X className="size-4" />
												</button>
											</Dialog.Close>
										</div>

										<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-surface p-3 text-xs">
											<div>
												<span className="text-muted-foreground">Nilai Total IKPA</span>
												<p className="text-base font-bold text-foreground mt-0.5">
													{inspectItem.totalScore !== null ? formatNumber(inspectItem.totalScore) : "—"}
												</p>
											</div>
											<div>
												<span className="text-muted-foreground">Target KPPN</span>
												<p className="text-base font-bold text-foreground mt-0.5">
													{formatNumber(inspectItem.targetScore)}
												</p>
											</div>
											<div>
												<span className="text-muted-foreground">Periode</span>
												<p className="text-xs font-semibold text-foreground mt-1">
													{MONTH_NAMES[inspectItem.month - 1] || `Bulan ${inspectItem.month}`}
												</p>
											</div>
											<div>
												<span className="text-muted-foreground">Rule Set</span>
												<p className="text-xs font-mono font-semibold text-foreground mt-1">
													{inspectItem.ruleSetVersion}
												</p>
											</div>
										</div>

										{/* Breakdown 8 Indikator */}
										<div className="space-y-2">
											<h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
												Rincian 8 Indikator IKPA
											</h4>
											<div className="divide-y divide-border/60 rounded-xl border border-border bg-background">
												{INDICATOR_CANONICAL_ORDER.map((ind) => {
													const scoreObj = breakdownMap.get(ind.key);
													return (
														<div
															key={ind.key}
															className="flex items-center justify-between p-2.5 text-xs"
														>
															<span className="font-medium text-foreground">
																{ind.label}
															</span>
															<div className="text-right">
																<span className="font-bold text-foreground">
																	{formatNumber(scoreObj?.rawScore ?? 0)}
																</span>
																<span className="ml-2 text-[11px] text-muted-foreground">
																	({formatNumber(scoreObj?.contrib ?? 0)} pts)
																</span>
															</div>
														</div>
													);
												})}
											</div>
										</div>

										{/* Modal Actions */}
										<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 pt-4">
											{isScenario && inspectItem.impactedIndicators.length > 0 && (() => {
												const firstKey = inspectItem.impactedIndicators[0];
												const routeInfo = resolveIndicatorRoute(firstKey);
												if (!routeInfo) return <div />;
												return (
													<button
														type="button"
														onClick={() => {
															setInspectItem(null);
															navigate({ to: routeInfo.route as never });
														}}
														className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
													>
														<span>Buka {routeInfo.label}</span>
														<ExternalLink className="size-3.5" />
													</button>
												);
											})()}

											<div className="flex items-center gap-2 ml-auto">
												<button
													type="button"
													onClick={() => {
														toggleSelectForCompare(inspectItem.id);
														setInspectItem(null);
														setActiveTab("compare");
													}}
													className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition"
												>
													Bandingkan
												</button>
												<Dialog.Close asChild>
													<button
														type="button"
														className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
													>
														Tutup
													</button>
												</Dialog.Close>
											</div>
										</div>
									</div>
								);
							})()}
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog.Root>

				{/* DELETE CONFIRMATION MODAL */}
				<Dialog.Root open={Boolean(deletingScenario)} onOpenChange={(open) => !open && setDeletingScenario(null)}>
					<Dialog.Portal>
						<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs" />
						<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-danger/30 bg-background p-6 shadow-2xl outline-none">
							{deletingScenario && (
								<div className="space-y-4">
									<div className="flex items-center gap-3">
										<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
											<Trash2 className="size-5" />
										</div>
										<div>
											<Dialog.Title className="text-base font-bold text-foreground">
												Hapus Skenario?
											</Dialog.Title>
											<p className="text-xs text-muted-foreground">
												Tindakan ini akan menghapus skenario secara permanen dari daftar.
											</p>
										</div>
									</div>

									<p className="text-xs text-foreground bg-surface p-3 rounded-xl border border-border/80">
										Nama skenario: <strong className="font-semibold">{deletingScenario.name}</strong>
									</p>

									<div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
										<Dialog.Close asChild>
											<button
												type="button"
												disabled={isProcessingDelete}
												className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
											>
												Batal
											</button>
										</Dialog.Close>
										<button
											type="button"
											onClick={handleDeleteConfirm}
											disabled={isProcessingDelete}
											className="rounded-xl bg-danger px-4 py-2 text-xs font-semibold text-danger-foreground hover:bg-danger/90 transition disabled:opacity-50"
										>
											{isProcessingDelete ? "Menghapus..." : "Ya, Hapus Skenario"}
										</button>
									</div>
								</div>
							)}
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog.Root>

				{/* EDIT SCENARIO MODAL */}
				<Dialog.Root open={Boolean(editingScenario)} onOpenChange={(open) => !open && setEditingScenario(null)}>
					<Dialog.Portal>
						<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs" />
						<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-2xl outline-none max-h-[88dvh] overflow-y-auto">
							{editingScenario && (
								<form onSubmit={handleSaveEdit} className="space-y-4">
									<div className="flex items-center justify-between border-b border-border/80 pb-3">
										<div className="flex items-center gap-2.5">
											<div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
												<Pencil className="size-4" />
											</div>
											<div>
												<Dialog.Title className="text-sm font-bold text-foreground sm:text-base">
													Edit Skenario &amp; Nilai Indikator
												</Dialog.Title>
												<p className="text-[11px] text-muted-foreground">
													Ubah nama, target, atau sesuaikan langsung estimasi nominal/skor 8 indikator IKPA.
												</p>
											</div>
										</div>
										<Dialog.Close asChild>
											<button
												type="button"
												className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
											>
												<X className="size-4" />
											</button>
										</Dialog.Close>
									</div>

									<div className="space-y-3">
										<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
											<div className="sm:col-span-2">
												<label htmlFor="edit-scenario-name" className="block text-xs font-semibold text-foreground">
													Nama Skenario <span className="text-danger">*</span>
												</label>
												<input
													id="edit-scenario-name"
													type="text"
													value={editScenarioName}
													onChange={(e) => setEditScenarioName(e.target.value)}
													placeholder="Contoh: Skenario A: Optimalisasi RPD"
													className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
													required
												/>
											</div>

											<div>
												<label htmlFor="edit-scenario-target" className="block text-xs font-semibold text-foreground">
													Target Nilai IKPA
												</label>
										<input
												id="edit-scenario-target"
												type="text"
												inputMode="decimal"
												value={editTargetScore}
												onChange={(e) => setEditTargetScore(e.target.value.replace(",", "."))}
												placeholder="95.00"
												className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
											/>
											</div>
										</div>

										{/* Total Recalculated Score Banner */}
										<div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs">
											<div>
												<span className="font-bold text-primary">
													Estimasi Total Nilai IKPA Terbobot
												</span>
												<p className="text-[11px] text-muted-foreground">
													Dihitung otomatis dari akumulasi bobot resmi 8 indikator di bawah
												</p>
											</div>
											<div className="text-right">
												<strong className="text-lg font-extrabold text-primary">
													{formatNumber(editCalculatedTotal)}
												</strong>
												<span className="text-[10px] text-muted-foreground block">
													dari 100.00 poin
												</span>
											</div>
										</div>

										{/* 8 Indicators Value Editor Grid */}
										<div>
											<label className="block text-xs font-semibold text-foreground mb-1.5">
												Penyesuaian Skor Nilai per Indikator (0 s.d. 100):
											</label>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto rounded-xl border border-border/70 bg-surface p-2.5">
												{INDICATOR_CANONICAL_ORDER.map((ind) => {
													const currentVal = editIndicatorScores[ind.key] ?? 100;
													const contrib = (currentVal * ind.weight) / 100;
													return (
														<div
															key={ind.key}
															className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-2 text-xs"
														>
															<div className="min-w-0 pr-2">
																<p className="font-semibold text-foreground truncate text-[11px]">
																	{ind.label}
																</p>
																<span className="text-[10px] text-muted-foreground">
																	Bobot: {ind.weight}% · Poin: {formatNumber(contrib)} pts
																</span>
															</div>
															<div className="flex items-center gap-1 shrink-0">
															<input
																type="text"
																inputMode="decimal"
																value={String(currentVal)}
																onChange={(e) => {
																	const normalized = e.target.value.replace(",", ".").trim();
																	if (normalized === "") {
																		setEditIndicatorScores((prev) => ({
																			...prev,
																			[ind.key]: 0,
																		}));
																		return;
																	}
																	const val = parseFloat(normalized);
																	if (!Number.isFinite(val)) return;
																	setEditIndicatorScores((prev) => ({
																		...prev,
																		[ind.key]: Math.min(Math.max(val, 0), 100),
																	}));
																}}
																aria-label={`Skor ${ind.label}`}
																className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-right text-xs font-bold text-foreground focus:border-primary focus:outline-none"
															/>
															</div>
														</div>
													);
												})}
											</div>
										</div>

										{/* Quick Jump to Instruments */}
										<div className="rounded-xl border border-border/80 bg-surface p-3 text-xs space-y-2">
											<p className="font-semibold text-foreground">
												Atau Buka Langsung Menu Workspace Indikator:
											</p>
											<div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
												<button
													type="button"
													onClick={() => {
														setEditingScenario(null);
														navigate({ to: "/operator/deviasi" as never });
													}}
													className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition text-center"
												>
													Deviasi Hal III
												</button>
												<button
													type="button"
													onClick={() => {
														setEditingScenario(null);
														navigate({ to: "/operator/penyerapan" as never });
													}}
													className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition text-center"
												>
													Penyerapan
												</button>
												<button
													type="button"
													onClick={() => {
														setEditingScenario(null);
														navigate({ to: "/operator/up-tup" as never });
													}}
													className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition text-center"
												>
													UP/TUP &amp; KKP
												</button>
												<button
													type="button"
													onClick={() => {
														setEditingScenario(null);
														navigate({ to: "/operator/data/output-achievement" as never });
													}}
													className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition text-center"
												>
													Capaian Output
												</button>
											</div>
										</div>
									</div>

									<div className="flex items-center justify-end gap-2 border-t border-border/80 pt-3">
										<Dialog.Close asChild>
											<button
												type="button"
												disabled={isSavingEdit}
												className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
											>
												Batal
											</button>
										</Dialog.Close>
										<button
											type="submit"
											disabled={isSavingEdit}
											className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition disabled:opacity-50"
										>
											{isSavingEdit ? "Menyimpan..." : "Simpan Perubahan"}
										</button>
									</div>
								</form>
							)}
						</Dialog.Content>
					</Dialog.Portal>
				</Dialog.Root>
			</div>
		</OperatorShell>
	);
}
