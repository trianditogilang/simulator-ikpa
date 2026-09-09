import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	Check,
	CheckCircle2,
	Edit,
	Eye,
	Plus,
	Scale,
	ShieldAlert,
	ShieldCheck,
	X,
} from "lucide-react";

import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
	fetchAllFairnessProposals,
	fetchFairnessPolicies,
	reviewProposal,
	saveFairnessPolicy,
	type FairnessPolicy,
	type FairnessProposal,
} from "@/services/output-achievement-service";

export const Route = createFileRoute("/admin-kppn/policy/fairness")({
	loader: async () => {
		const [policies, proposals] = await Promise.all([
			fetchFairnessPolicies(2026),
			fetchAllFairnessProposals(),
		]);
		return { policies, proposals };
	},
	component: AdminFairnessPolicyPage,
});

const DEFAULT_POLICY_TEMPLATE: Partial<FairnessPolicy> = {
	name: "Pengecualian RO Khusus",
	indicatorKey: "output_achievement",
	action: "exclude_from_assessment",
	category: "ro_khusus",
	matchType: "exact",
	roMatchValue: "FAN.ZZ1",
	scopeType: "national",
	year: 2026,
	effectiveMonthStart: 1,
	effectiveMonthEnd: 12,
	basisReference: "Fairness treatment IKPA TA 2026",
	displayReason: "RO Khusus tidak menjadi objek penilaian Indikator Capaian Output",
	internalNote: "Sesuai kebijakan nasional IKPA 2026",
	allowOperatorProposal: true,
	status: "published",
};

function AdminFairnessPolicyPage() {
	const initialData = Route.useLoaderData();
	const [policies, setPolicies] = useState<FairnessPolicy[]>(
		initialData.policies || [],
	);
	const [proposals, setProposals] = useState<FairnessProposal[]>(
		initialData.proposals || [],
	);

	const [activeTab, setActiveTab] = useState<"policies" | "proposals">(
		"policies",
	);
	const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
	const [editingPolicy, setEditingPolicy] =
		useState<Partial<FairnessPolicy> | null>(null);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Review Proposal Modal State
	const [reviewingProposal, setReviewingProposal] =
		useState<FairnessProposal | null>(null);
	const [reviewNote, setReviewNote] = useState("");

	// Live Preview Tester State
	const [testRoCode, setTestRoCode] = useState("FAN.ZZ1");
	const [testMonth, setTestMonth] = useState<number>(1);

	const handleSavePolicy = async () => {
		if (!editingPolicy?.name || !editingPolicy.roMatchValue) {
			setErrorMessage("Nama kebijakan dan nilai pencocokan RO wajib diisi.");
			return;
		}

		try {
			const formattedValue =
				typeof editingPolicy.roMatchValue === "string"
					? editingPolicy.roMatchValue.includes(",")
						? editingPolicy.roMatchValue.split(",").map((s) => s.trim())
						: editingPolicy.roMatchValue.trim()
					: editingPolicy.roMatchValue;

			await saveFairnessPolicy({
				id: editingPolicy.id,
				name: editingPolicy.name,
				matchType:
					(editingPolicy.matchType as "exact" | "list" | "prefix" | "regex") ||
					"exact",
				roMatchValue: formattedValue,
				scopeType:
					(editingPolicy.scopeType as
						| "national"
						| "kppn"
						| "organization") || "national",
				year: editingPolicy.year ?? 2026,
				effectiveMonthStart: editingPolicy.effectiveMonthStart ?? 1,
				effectiveMonthEnd: editingPolicy.effectiveMonthEnd ?? 12,
				basisReference:
					editingPolicy.basisReference || "Fairness treatment IKPA TA 2026",
				displayReason:
					editingPolicy.displayReason ||
					"RO Khusus tidak menjadi objek penilaian",
				internalNote: editingPolicy.internalNote,
				allowOperatorProposal: editingPolicy.allowOperatorProposal ?? false,
				status:
					(editingPolicy.status as
						| "draft"
						| "published"
						| "retired"
						| "expired") || "published",
			});


			const updated = await fetchFairnessPolicies(2026);
			setPolicies(updated);
			setIsPolicyModalOpen(false);
			setEditingPolicy(null);
			setActionMessage("Kebijakan fairness treatment berhasil disimpan.");
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan kebijakan.",
			);
		}
	};

	const handleReviewProposal = async (status: "approved" | "rejected") => {
		if (!reviewingProposal) return;
		try {
			await reviewProposal({
				proposalId: reviewingProposal.id,
				status,
				reviewNote,
			});

			const updated = await fetchAllFairnessProposals();
			setProposals(updated);
			setReviewingProposal(null);
			setReviewNote("");
			setActionMessage(
				`Usulan RO ${reviewingProposal.roCode} berhasil di-${status === "approved" ? "setujui" : "tolak"}.`,
			);
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal memproses review usulan.",
			);
		}
	};

	// Test RO match against current policies
	const testResult = (() => {
		const uCode = testRoCode.trim().toUpperCase();
		if (!uCode) return { matched: false, reason: "Masukkan kode RO" };

		for (const pol of policies) {
			if (pol.status !== "published") continue;
			if (testMonth < pol.effectiveMonthStart || testMonth > pol.effectiveMonthEnd)
				continue;

			let isMatch = false;
			if (pol.matchType === "exact") {
				if (Array.isArray(pol.roMatchValue)) {
					isMatch = pol.roMatchValue.some(
						(v) => String(v).trim().toUpperCase() === uCode,
					);
				} else {
					isMatch = String(pol.roMatchValue).trim().toUpperCase() === uCode;
				}
			} else if (pol.matchType === "prefix") {
				if (Array.isArray(pol.roMatchValue)) {
					isMatch = pol.roMatchValue.some((v) =>
						uCode.startsWith(String(v).trim().toUpperCase()),
					);
				} else {
					isMatch = uCode.startsWith(
						String(pol.roMatchValue).trim().toUpperCase(),
					);
				}
			} else if (pol.matchType === "list") {
				const list = Array.isArray(pol.roMatchValue)
					? pol.roMatchValue
					: String(pol.roMatchValue).split(/[,\s;|]+/);
				isMatch = list.some((v) => String(v).trim().toUpperCase() === uCode);
			}

			if (isMatch) {
				return {
					matched: true,
					policyName: pol.name,
					reason: pol.displayReason,
					reference: pol.basisReference,
				};
			}
		}

		if (uCode === "FAN.ZZ1" || uCode.includes("FAN.ZZ1")) {
			return {
				matched: true,
				policyName: "RO Khusus Standar TA 2026",
				reason:
					"RO Khusus tidak menjadi objek penilaian Indikator Capaian Output",
				reference: "Fairness treatment IKPA TA 2026",
			};
		}

		return {
			matched: false,
			reason: "RO dinilai secara normal (tidak dikecualikan).",
		};
	})();

	return (
		<AdminShell currentPath="/admin-kppn/policy/fairness">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
							<Scale className="size-5" />
						</div>
						<div>
							<h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
								Fairness Treatment & Pengecualian Penilaian
							</h1>
							<p className="text-xs text-muted-foreground sm:text-sm">
								Kebijakan pengecualian Rincian Output (RO Khusus, Keadaan
								Kahar) dari pembilang & penyebut penilaian IKPA TA 2026.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								setEditingPolicy({ ...DEFAULT_POLICY_TEMPLATE });
								setIsPolicyModalOpen(true);
							}}
							className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs"
						>
							<Plus className="size-4" />
							<span>Tambah Kebijakan Fairness</span>
						</button>
					</div>
				</div>

				{/* Toast & Alert */}
				{actionMessage && (
					<div className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<CheckCircle2 className="size-4 shrink-0" />
						<p>{actionMessage}</p>
					</div>
				)}
				{errorMessage && (
					<div className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs">
						<AlertCircle className="size-4 shrink-0" />
						<p>{errorMessage}</p>
					</div>
				)}

				{/* Rule & Regulations Highlight Strip */}
				<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-3">
					<div className="flex items-center gap-2">
						<ShieldCheck className="size-4 text-primary" />
						<h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
							Prinsip Regulasi Fairness Treatment (PER-5/PB/2024)
						</h2>
					</div>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
						<div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
							<p className="font-semibold text-foreground">
								1. Dikeluarkan dari Pembilang & Penyebut
							</p>
							<p className="text-muted-foreground text-[11px]">
								RO yang dikecualikan tidak dihitung dalam NK-ROKW maupun NK-CRO
								tanpa menghilangkan data laporan satker.
							</p>
						</div>
						<div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
							<p className="font-semibold text-foreground">
								2. RO Khusus & Dispensasi
							</p>
							<p className="text-muted-foreground text-[11px]">
								Kategori default mencakup RO Khusus seperti FAN.ZZ1 serta
								pengecualian bersyarat atas persetujuan KPPN/Pusat.
							</p>
						</div>
						<div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
							<p className="font-semibold text-foreground">
								3. Audit Trail & Transparansi
							</p>
							<p className="text-muted-foreground text-[11px]">
								Setiap perubahan status dan review usulan dicatat permanen dalam
								Audit Log dengan riwayat verifikator.
							</p>
						</div>
					</div>
				</div>

				{/* Tabs: Kebijakan Aktif vs Usulan Operator */}
				<div className="flex items-center justify-between border-b border-border pb-2">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setActiveTab("policies")}
							className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
								activeTab === "policies"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Daftar Kebijakan Fairness ({policies.length})
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("proposals")}
							className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
								activeTab === "proposals"
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Usulan Satker ({proposals.length})
							{proposals.filter((p) => p.status === "submitted").length > 0 && (
								<span className="ml-1.5 rounded-full bg-warning px-1.5 py-0.2 text-[10px] text-warning-foreground font-bold">
									{proposals.filter((p) => p.status === "submitted").length}
								</span>
							)}
						</button>
					</div>
				</div>

				{activeTab === "policies" && (
					<div className="space-y-6">
						{/* Policy Table */}
						<div className="rounded-2xl border border-border bg-background shadow-xs overflow-hidden">
							<table className="w-full text-left text-xs">
								<thead>
									<tr className="border-b border-border bg-surface-muted/60 text-muted-foreground font-semibold">
										<th className="py-3.5 pl-4 pr-2">Nama Kebijakan</th>
										<th className="px-3 py-3.5">Kode RO / Pola</th>
										<th className="px-3 py-3.5">Metode Cocok</th>
										<th className="px-3 py-3.5">Periode Berlaku</th>
										<th className="px-3 py-3.5">Dasar Hukum</th>
										<th className="px-3 py-3.5 text-center">Status</th>
										<th className="py-3.5 pl-2 pr-4 text-right">Aksi</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/60">
									{policies.length === 0 ? (
										<tr>
											<td
												colSpan={7}
												className="py-8 text-center text-muted-foreground"
											>
												Belum ada kebijakan fairness kustom terdaftar. (Default
												FAN.ZZ1 aktif otomatis)
											</td>
										</tr>
									) : (
										policies.map((pol) => (
											<tr
												key={pol.id}
												className="transition-colors hover:bg-surface-muted/30"
											>
												<td className="py-3.5 pl-4 pr-2">
													<p className="font-semibold text-foreground">
														{pol.name}
													</p>
													<p className="text-[11px] text-muted-foreground">
														{pol.displayReason}
													</p>
												</td>
												<td className="px-3 py-3.5 font-mono font-bold text-foreground">
													{Array.isArray(pol.roMatchValue)
														? pol.roMatchValue.join(", ")
														: String(pol.roMatchValue)}
												</td>
												<td className="px-3 py-3.5 text-muted-foreground uppercase text-[11px] font-semibold">
													{pol.matchType}
												</td>
												<td className="px-3 py-3.5 text-muted-foreground">
													Bulan {pol.effectiveMonthStart} s.d.{" "}
													{pol.effectiveMonthEnd}
												</td>
												<td className="px-3 py-3.5 text-muted-foreground">
													{pol.basisReference}
												</td>
												<td className="px-3 py-3.5 text-center">
													<span
														className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
															pol.status === "published"
																? "bg-success/10 text-success"
																: "bg-surface-muted text-muted-foreground"
														}`}
													>
														{pol.status}
													</span>
												</td>
												<td className="py-3.5 pl-2 pr-4 text-right">
													<button
														type="button"
														onClick={() => {
															setEditingPolicy({
																...pol,
																roMatchValue: Array.isArray(pol.roMatchValue)
																	? pol.roMatchValue.join(", ")
																	: pol.roMatchValue,
															});
															setIsPolicyModalOpen(true);
														}}
														className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-muted transition"
													>
														<Edit className="size-3" />
														<span>Edit</span>
													</button>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>

						{/* Live Simulator Tester */}
						<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-3">
							<div className="flex items-center gap-2">
								<Eye className="size-4 text-primary" />
								<h3 className="text-sm font-bold text-foreground">
									Simulator Uji Pencocokan RO (Fairness Rule Tester)
								</h3>
							</div>
							<p className="text-xs text-muted-foreground">
								Uji apakah suatu kode RO akan otomatis dikecualikan dari
								penilaian Capaian Output pada bulan tertentu.
							</p>
							<div className="flex flex-wrap items-center gap-3 pt-1">
								<input
									type="text"
									placeholder="Contoh: FAN.ZZ1 atau 5212.EBA.001"
									value={testRoCode}
									onChange={(e) => setTestRoCode(e.target.value)}
									className="min-h-9 w-64 rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
								<select
									value={testMonth}
									onChange={(e) => setTestMonth(Number(e.target.value))}
									className="min-h-9 rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
										<option key={m} value={m}>
											Bulan {m}
										</option>
									))}
								</select>
								<div
									className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
										testResult.matched
											? "bg-purple-500/10 text-purple-700 border border-purple-500/30"
											: "bg-success/10 text-success border border-success/30"
									}`}
								>
									{testResult.matched ? (
										<>
											<ShieldAlert className="size-3.5" />
											<span>
												Dikecualikan: {testResult.reason} ({testResult.reference}
												)
											</span>
										</>
									) : (
										<>
											<Check className="size-3.5" />
											<span>{testResult.reason}</span>
										</>
									)}
								</div>
							</div>
						</div>
					</div>
				)}

				{activeTab === "proposals" && (
					<div className="rounded-2xl border border-border bg-background shadow-xs overflow-hidden">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border bg-surface-muted/60 text-muted-foreground font-semibold">
									<th className="py-3.5 pl-4 pr-2">Satker / Tanggal</th>
									<th className="px-3 py-3.5">Kode RO</th>
									<th className="px-3 py-3.5">Periode Bulan</th>
									<th className="px-3 py-3.5">Kategori</th>
									<th className="px-3 py-3.5">Dasar & Catatan Operator</th>
									<th className="px-3 py-3.5 text-center">Status</th>
									<th className="py-3.5 pl-2 pr-4 text-right">Aksi Review</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{proposals.length === 0 ? (
									<tr>
										<td
											colSpan={7}
											className="py-8 text-center text-muted-foreground"
										>
											Belum ada usulan pengecualian dari operator Satker.
										</td>
									</tr>
								) : (
									proposals.map((prop) => (
										<tr
											key={prop.id}
											className="transition-colors hover:bg-surface-muted/30"
										>
											<td className="py-3.5 pl-4 pr-2">
												<p className="font-semibold text-foreground">
													Satker ID: {prop.organizationId.slice(0, 8)}...
												</p>
												<p className="text-[11px] text-muted-foreground">
													{prop.submittedAt
														? new Date(prop.submittedAt).toLocaleDateString(
																"id-ID",
															)
														: "—"}
												</p>
											</td>
											<td className="px-3 py-3.5 font-mono font-bold text-foreground">
												{prop.roCode}
											</td>
											<td className="px-3 py-3.5 text-muted-foreground">
												{prop.month ? `Bulan ${prop.month}` : "Semua Bulan"}
											</td>
											<td className="px-3 py-3.5 text-muted-foreground capitalize">
												{prop.category.replace("_", " ")}
											</td>
											<td className="px-3 py-3.5">
												<p className="font-semibold text-foreground">
													{prop.basisReference}
												</p>
												<p className="text-[11px] text-muted-foreground">
													{prop.operatorNote || "Tidak ada catatan."}
												</p>
											</td>
											<td className="px-3 py-3.5 text-center">
												<span
													className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
														prop.status === "approved"
															? "bg-success/10 text-success"
															: prop.status === "rejected"
																? "bg-danger/10 text-danger"
																: "bg-warning/10 text-warning"
													}`}
												>
													{prop.status === "submitted"
														? "Menunggu Review"
														: prop.status}
												</span>
											</td>
											<td className="py-3.5 pl-2 pr-4 text-right">
												{prop.status === "submitted" ? (
													<button
														type="button"
														onClick={() => {
															setReviewingProposal(prop);
															setReviewNote("");
														}}
														className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
													>
														<span>Review</span>
													</button>
												) : (
													<span className="text-[11px] text-muted-foreground">
														Tuntas
													</span>
												)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}

				{/* Modal: Tambah / Edit Kebijakan Fairness */}
				{isPolicyModalOpen && editingPolicy && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-bold text-foreground">
										{editingPolicy.id
											? "Edit Kebijakan Fairness"
											: "Tambah Kebijakan Fairness"}
									</h3>
									<p className="text-xs text-muted-foreground">
										Tentukan aturan pengecualian rincian output dari penilaian.
									</p>
								</div>
								<button
									type="button"
									onClick={() => {
										setIsPolicyModalOpen(false);
										setEditingPolicy(null);
									}}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-3.5 text-xs">
								<div className="space-y-1">
									<label htmlFor="policy-name" className="font-semibold text-foreground">
										Nama Kebijakan
									</label>
									<input
										id="policy-name"
										type="text"
										value={editingPolicy.name || ""}
										onChange={(e) =>
											setEditingPolicy({
												...editingPolicy,
												name: e.target.value,
											})
										}
										placeholder="Contoh: Pengecualian RO Khusus FAN.ZZ1"
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1">
										<label htmlFor="policy-match-type" className="font-semibold text-foreground">
											Metode Pencocokan (Match Type)
										</label>
										<select
											id="policy-match-type"
											value={editingPolicy.matchType || "exact"}
											onChange={(e) =>
												setEditingPolicy({
													...editingPolicy,
													matchType: e.target.value as FairnessPolicy["matchType"],
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="exact">Exact (Persis Sama)</option>
											<option value="prefix">Prefix (Awalan Kode)</option>
											<option value="list">List (Daftar Kode)</option>
											<option value="regex">Regex (Pola Reguler)</option>
										</select>
									</div>

									<div className="space-y-1">
										<label htmlFor="policy-status" className="font-semibold text-foreground">
											Status Kebijakan
										</label>
										<select
											id="policy-status"
											value={editingPolicy.status || "published"}
											onChange={(e) =>
												setEditingPolicy({
													...editingPolicy,
													status: e.target.value as FairnessPolicy["status"],
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="published">Published (Aktif)</option>
											<option value="draft">Draft</option>
											<option value="retired">Retired (Nonaktif)</option>
										</select>
									</div>
								</div>

								<div className="space-y-1">
									<label htmlFor="policy-ro-match" className="font-semibold text-foreground">
										Kode RO yang Dicocokkan (Gunakan koma untuk banyak kode)
									</label>
									<input
										id="policy-ro-match"
										type="text"
										value={
											typeof editingPolicy.roMatchValue === "string"
												? editingPolicy.roMatchValue
												: Array.isArray(editingPolicy.roMatchValue)
													? editingPolicy.roMatchValue.join(", ")
													: ""
										}
										onChange={(e) =>
											setEditingPolicy({
												...editingPolicy,
												roMatchValue: e.target.value,
											})
										}
										placeholder="Contoh: FAN.ZZ1, FAN.ZZ2"
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-mono font-bold text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1">
										<label htmlFor="policy-month-start" className="font-semibold text-foreground">
											Bulan Mulai Berlaku
										</label>
										<input
											id="policy-month-start"
											type="number"
											min={1}
											max={12}
											value={editingPolicy.effectiveMonthStart ?? 1}
											onChange={(e) =>
												setEditingPolicy({
													...editingPolicy,
													effectiveMonthStart: Number(e.target.value),
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										/>
									</div>
									<div className="space-y-1">
										<label htmlFor="policy-month-end" className="font-semibold text-foreground">
											Bulan Akhir Berlaku
										</label>
										<input
											id="policy-month-end"
											type="number"
											min={1}
											max={12}
											value={editingPolicy.effectiveMonthEnd ?? 12}
											onChange={(e) =>
												setEditingPolicy({
													...editingPolicy,
													effectiveMonthEnd: Number(e.target.value),
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										/>
									</div>
								</div>

								<div className="space-y-1">
									<label htmlFor="policy-basis" className="font-semibold text-foreground">
										Dasar Regulasi / Referensi
									</label>
									<input
										id="policy-basis"
										type="text"
										value={editingPolicy.basisReference || ""}
										onChange={(e) =>
											setEditingPolicy({
												...editingPolicy,
												basisReference: e.target.value,
											})
										}
										placeholder="Contoh: PER-5/PB/2024 atau Fairness treatment IKPA TA 2026"
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

								<div className="space-y-1">
									<label htmlFor="policy-display-reason" className="font-semibold text-foreground">
										Keterangan / Alasan Ditampilkan ke Satker
									</label>
									<input
										id="policy-display-reason"
										type="text"
										value={editingPolicy.displayReason || ""}
										onChange={(e) =>
											setEditingPolicy({
												...editingPolicy,
												displayReason: e.target.value,
											})
										}
										placeholder="Contoh: RO Khusus tidak menjadi objek penilaian Capaian Output"
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button
									type="button"
									onClick={() => {
										setIsPolicyModalOpen(false);
										setEditingPolicy(null);
									}}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={handleSavePolicy}
									className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									Simpan Kebijakan
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Modal: Review Usulan Satker */}
				{reviewingProposal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-bold text-foreground">
										Review Usulan Pengecualian RO
									</h3>
									<p className="text-xs text-muted-foreground">
										Kode RO: {reviewingProposal.roCode} (
										{reviewingProposal.month
											? `Bulan ${reviewingProposal.month}`
											: "Semua Bulan"}
										)
									</p>
								</div>
								<button
									type="button"
									onClick={() => setReviewingProposal(null)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-3 text-xs">
								<div>
									<span className="text-muted-foreground">Dasar Usulan:</span>
									<p className="font-semibold text-foreground">
										{reviewingProposal.basisReference}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Catatan Satker:</span>
									<p className="text-foreground">
										{reviewingProposal.operatorNote || "Tidak ada catatan."}
									</p>
								</div>
							</div>

							<div className="space-y-1 text-xs">
								<label htmlFor="policy-review-note" className="font-semibold text-foreground">
									Catatan Verifikator KPPN:
								</label>
								<textarea
									id="policy-review-note"
									rows={3}
									value={reviewNote}
									onChange={(e) => setReviewNote(e.target.value)}
									placeholder="Masukkan pertimbangan persetujuan / penolakan..."
									className="w-full rounded-lg border border-border bg-surface p-2.5 text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button
									type="button"
									onClick={() => handleReviewProposal("rejected")}
									className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2 text-xs font-semibold text-danger hover:bg-danger/20 transition"
								>
									Tolak Usulan
								</button>
								<button
									type="button"
									onClick={() => handleReviewProposal("approved")}
									className="rounded-lg bg-success px-3.5 py-2 text-xs font-semibold text-success-foreground hover:bg-success/90 transition shadow-xs"
								>
									Setujui Pengecualian
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</AdminShell>
	);
}
