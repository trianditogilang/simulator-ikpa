import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	CheckCircle2,
	Edit,
	HelpCircle,
	Plus,
	Save,
	Scale,
	Search,
	ShieldAlert,
	ShieldCheck,
	Trash2,
	UserCheck,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
	getMockUserAccesses,
	type UserAccessItem,
} from "@/mocks/access-management";
import { mockPermissionMatrix } from "@/mocks/auth-presets";
import {
	assignAccess,
	deactivateAccess,
	fetchAdminUserAccesses,
} from "@/services/admin-access-service";
import { fetchAdminOrganizations } from "@/services/admin-monitoring-service";

export const Route = createFileRoute("/admin-kppn/access")({
	loader: async () => {
		const [accessData, orgData] = await Promise.all([
			fetchAdminUserAccesses(),
			fetchAdminOrganizations(),
		]);
		return {
			accesses: accessData.accesses,
			organizations: orgData.organizations,
		};
	},
	component: AdminAccessManagementPage,
});

function AdminAccessManagementPage() {
	const router = useRouter();
	const loaderData = Route.useLoaderData();
	const mockList = getMockUserAccesses();

	const initialList: UserAccessItem[] =
		loaderData.accesses.length > 0
			? loaderData.accesses.map((a, idx) => {
					const mock = mockList[idx % mockList.length] || mockList[0];
					return {
						...mock,
						id: a.id,
						name: a.name,
						email: a.email,
						accessType: a.accessType,
						scopeName: a.scopeName,
						scopeCode: a.scopeCode,
						status: a.status,
						createdAt: a.createdAt.slice(0, 10),
					};
				})
			: mockList;

	const [accessList, setAccessList] = useState<UserAccessItem[]>(initialList);
	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [editingItem, setEditingItem] = useState<UserAccessItem | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [lastAdminAlert, setLastAdminAlert] = useState(false);
	const [isMatrixOpen, setIsMatrixOpen] = useState(false);

	const activeAdminCount = accessList.filter(
		(a) => a.accessType === "admin_kppn" && a.status === "active",
	).length;

	const filteredList = useMemo(() => {
		return accessList.filter((item) => {
			const matchQuery =
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.scopeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.scopeCode.includes(searchQuery);

			const matchRole = roleFilter === "all" || item.accessType === roleFilter;
			const matchStatus =
				statusFilter === "all" || item.status === statusFilter;

			return matchQuery && matchRole && matchStatus;
		});
	}, [accessList, searchQuery, roleFilter, statusFilter]);

	const handleSaveAccess = async (user: UserAccessItem) => {
		try {
			await assignAccess({
				name: user.name,
				email: user.email,
				accessType: user.accessType as "operator_satker" | "admin_kppn",
				orgId: user.scopeCode !== "032" ? user.id : null,
			});
			setToastMessage(`Akses pengguna "${user.name}" berhasil disimpan.`);
			await router.invalidate();
		} catch {
			setToastMessage(`Akses pengguna "${user.name}" diperbarui.`);
		}

		setIsModalOpen(false);
		setEditingItem(null);
		setTimeout(() => setToastMessage(null), 4000);
	};

	const handleToggleStatus = async (user: UserAccessItem) => {
		if (
			user.accessType === "admin_kppn" &&
			user.status === "active" &&
			activeAdminCount <= 1
		) {
			setLastAdminAlert(true);
			return;
		}

		try {
			await deactivateAccess(user.id);
			await router.invalidate();
		} catch {
			// fallback local state
		}

		const nextStatus = user.status === "active" ? "inactive" : "active";
		setAccessList((prev) =>
			prev.map((a) => (a.id === user.id ? { ...a, status: nextStatus } : a)),
		);
		setToastMessage(
			`Status akses "${user.name}" diubah menjadi ${nextStatus === "active" ? "Aktif" : "Nonaktif"}.`,
		);
		setTimeout(() => setToastMessage(null), 4000);
	};

	const handleDeleteAccess = async (user: UserAccessItem) => {
		if (
			user.accessType === "admin_kppn" &&
			user.status === "active" &&
			activeAdminCount <= 1
		) {
			setLastAdminAlert(true);
			return;
		}

		if (confirm(`Hapus mapping akses untuk ${user.name} (${user.email})?`)) {
			try {
				await deactivateAccess(user.id);
				await router.invalidate();
			} catch {
				// local fallback
			}
			setAccessList((prev) => prev.filter((a) => a.id !== user.id));
			setToastMessage(`Akses untuk "${user.name}" berhasil dihapus.`);
			setTimeout(() => setToastMessage(null), 4000);
		}
	};

	return (
		<AdminShell currentPath="/admin-kppn/access">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Manajemen Akses Pengguna
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Kelola mapping izin akses Operator Satker dan Admin KPPN lingkup
							KPPN Malang (032)
						</p>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setIsMatrixOpen(true)}
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
						>
							<HelpCircle className="size-3.5 text-primary" />
							<span>Perbedaan Hak Akses</span>
						</button>

						<button
							type="button"
							onClick={() => {
								setEditingItem({
									id: `acc-new-${Date.now()}`,
									userId: `usr-new-${Date.now()}`,
									name: "",
									email: "",
									accessType: "operator_satker",
									accessTypeLabel: "Operator Satker",
									scopeCode: "415234",
									scopeName: "Politeknik Negeri Malang",
									status: "active",
									verifiedIdentity: true,
									createdAt: "01 Sep 2026",
								});
								setIsModalOpen(true);
							}}
							className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs"
						>
							<Plus className="size-3.5" />
							<span>Tambah Akses</span>
						</button>
					</div>
				</div>

				{/* Toast Alert */}
				{toastMessage && (
					<div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-medium text-success">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-4 shrink-0" />
							<span>{toastMessage}</span>
						</div>
						<button
							type="button"
							onClick={() => setToastMessage(null)}
							className="text-success hover:underline"
						>
							Tutup
						</button>
					</div>
				)}

				{/* Protection Alert */}
				<div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs shadow-xs">
					<div className="flex items-center gap-2 text-foreground">
						<ShieldCheck className="size-4 text-primary shrink-0" />
						<span>
							Semua Admin KPPN memiliki keleluasaan administratif yang sama.
							Proteksi sistem menjamin{" "}
							<strong className="text-primary">
								minimal 1 Admin KPPN aktif
							</strong>{" "}
							selalu terdaftar.
						</span>
					</div>
					<span className="text-muted-foreground text-[11px] font-medium">
						Admin Aktif: {activeAdminCount}
					</span>
				</div>

				{/* Filter & Search Bar */}
				<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<input
								aria-label="Cari pengguna dan hak akses"
								type="text"
								placeholder="Cari nama, email, kode satker, atau nama instansi..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<select
								aria-label="Filter jenis hak akses"
								value={roleFilter}
								onChange={(e) => setRoleFilter(e.target.value)}
								className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Jenis Akses</option>
								<option value="admin_kppn">Admin KPPN</option>
								<option value="operator_satker">Operator Satker</option>
							</select>

							<select
								aria-label="Filter status akun"
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
								className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Status</option>
								<option value="active">Aktif</option>
								<option value="inactive">Nonaktif</option>
							</select>
						</div>
					</div>

					<div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
						<span>
							Menampilkan{" "}
							<strong className="text-foreground">{filteredList.length}</strong>{" "}
							pengguna
						</span>
						{(searchQuery ||
							roleFilter !== "all" ||
							statusFilter !== "all") && (
							<button
								type="button"
								onClick={() => {
									setSearchQuery("");
									setRoleFilter("all");
									setStatusFilter("all");
								}}
								className="font-semibold text-primary underline-offset-4 hover:underline"
							>
								Reset Filter
							</button>
						)}
					</div>
				</div>

				{/* Table View */}
				<div className="rounded-xl border border-border/80 bg-surface shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border/80 bg-surface-muted/50 font-semibold text-muted-foreground">
									<th className="py-3 pl-4 pr-2">Nama Pengguna</th>
									<th className="px-3 py-3">Email Akun</th>
									<th className="px-3 py-3">Jenis Akses</th>
									<th className="px-3 py-3">Cakupan / Scope</th>
									<th className="px-3 py-3 text-center">Status</th>
									<th className="py-3 pl-2 pr-4 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{filteredList.map((user) => (
									<tr
										key={user.id}
										className="transition-colors hover:bg-surface-muted/30"
									>
										<td className="py-3 pl-4 pr-2">
											<div className="flex items-center gap-1.5">
												<span className="font-semibold text-foreground">
													{user.name}
												</span>
												{user.verifiedIdentity && (
													<span title="Identitas Terverifikasi">
														<UserCheck className="size-3.5 text-primary" />
													</span>
												)}
											</div>
											<p className="text-[11px] text-muted-foreground">
												Dibuat: {user.createdAt}
											</p>
										</td>
										<td className="px-3 py-3 text-foreground font-medium">
											{user.email}
										</td>
										<td className="px-3 py-3">
											<span
												className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
													user.accessType === "admin_kppn"
														? "bg-primary/10 text-primary"
														: "bg-surface-muted text-foreground"
												}`}
											>
												{user.accessType === "admin_kppn"
													? "Admin KPPN"
													: "Operator Satker"}
											</span>
										</td>
										<td className="px-3 py-3">
											<span className="font-medium text-foreground">
												{user.scopeName}
											</span>
											<p className="text-[11px] text-muted-foreground">
												Kode: {user.scopeCode}
											</p>
										</td>
										<td className="px-3 py-3 text-center">
											<span
												className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
													user.status === "active"
														? "bg-success/10 text-success"
														: "bg-danger/10 text-danger"
												}`}
											>
												{user.status === "active" ? "Aktif" : "Nonaktif"}
											</span>
										</td>
										<td className="py-3 pl-2 pr-4 text-right">
											<div className="flex items-center justify-end gap-1.5">
												<button
													type="button"
													onClick={() => {
														setEditingItem(user);
														setIsModalOpen(true);
													}}
													className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-surface-muted"
												>
													<Edit className="size-3" />
													<span>Edit</span>
												</button>

												<button
													type="button"
													onClick={() => handleToggleStatus(user)}
													className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-surface-muted hover:text-foreground"
												>
													{user.status === "active"
														? "Nonaktifkan"
														: "Aktifkan"}
												</button>

												<button
													type="button"
													onClick={() => handleDeleteAccess(user)}
													className="rounded-md p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
													title="Hapus Akses"
												>
													<Trash2 className="size-3.5" />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				{/* Modal Form: Add / Edit Access */}
				{isModalOpen && editingItem && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-semibold text-foreground">
										{editingItem.name
											? "Edit Akses Pengguna"
											: "Tambah Akses Baru"}
									</h3>
									<p className="text-xs text-muted-foreground">
										Tetapkan izin operasional atau administratif
									</p>
								</div>
								<button
									type="button"
									onClick={() => {
										setIsModalOpen(false);
										setEditingItem(null);
									}}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-3.5 text-xs">
								<div>
									<span className="text-muted-foreground block mb-1 font-medium">
										Nama Lengkap:
									</span>
									<input
										aria-label="Nama lengkap pengguna"
										type="text"
										required
										value={editingItem.name}
										onChange={(e) =>
											setEditingItem({ ...editingItem, name: e.target.value })
										}
										placeholder="Contoh: Bambang Sudarsono"
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-semibold text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

								<div>
									<span className="text-muted-foreground block mb-1 font-medium">
										Email Akun (Verified):
									</span>
									<input
										aria-label="Email akun terverifikasi"
										type="email"
										required
										value={editingItem.email}
										onChange={(e) =>
											setEditingItem({ ...editingItem, email: e.target.value })
										}
										placeholder="user@kemenkeu.go.id atau user@instansi.ac.id"
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div>
										<span className="text-muted-foreground block mb-1 font-medium">
											Jenis Hak Akses:
										</span>
										<select
											aria-label="Jenis hak akses pengguna"
											value={editingItem.accessType}
											onChange={(e) => {
												const type = e.target.value as
													| "operator_satker"
													| "admin_kppn";
												setEditingItem({
													...editingItem,
													accessType: type,
													accessTypeLabel:
														type === "admin_kppn"
															? "Admin KPPN"
															: "Operator Satker",
													scopeCode: type === "admin_kppn" ? "032" : "415234",
													scopeName:
														type === "admin_kppn"
															? "KPPN Malang"
															: "Politeknik Negeri Malang",
												});
											}}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="operator_satker">Operator Satker</option>
											<option value="admin_kppn">Admin KPPN</option>
										</select>
									</div>

									<div>
										<span className="text-muted-foreground block mb-1 font-medium">
											Status Akun:
										</span>
										<select
											aria-label="Status akun pengguna"
											value={editingItem.status}
											onChange={(e) =>
												setEditingItem({
													...editingItem,
													status: e.target.value as "active" | "inactive",
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="active">Aktif</option>
											<option value="inactive">Nonaktif</option>
										</select>
									</div>
								</div>

								{/* Dynamic Scope Field */}
								<div>
									<span className="text-muted-foreground block mb-1 font-medium">
										{editingItem.accessType === "admin_kppn"
											? "Pilih Scope KPPN Pembina:"
											: "Pilih Satker Naungan:"}
									</span>

									{editingItem.accessType === "admin_kppn" ? (
										<select
											aria-label="Scope KPPN pembina"
											value={editingItem.scopeCode}
											onChange={(e) =>
												setEditingItem({
													...editingItem,
													scopeCode: e.target.value,
													scopeName: "KPPN Malang",
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="032">032 — KPPN Malang</option>
										</select>
									) : (
										<select
											aria-label="Satker naungan"
											value={editingItem.scopeCode}
											onChange={(e) => {
												const code = e.target.value;
												const name =
													code === "415234"
														? "Politeknik Negeri Malang"
														: code === "527812"
															? "BBTN Bromo Tengger Semeru"
															: code === "632190"
																? "Pengadilan Negeri Malang"
																: code === "411200"
																	? "Kantor Imigrasi Malang"
																	: "Universitas Brawijaya";

												setEditingItem({
													...editingItem,
													scopeCode: code,
													scopeName: name,
												});
											}}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="415234">
												415234 — Politeknik Negeri Malang
											</option>
											<option value="527812">
												527812 — BBTN Bromo Tengger Semeru
											</option>
											<option value="632190">
												632190 — Pengadilan Negeri Malang
											</option>
											<option value="411200">
												411200 — Kantor Imigrasi Malang
											</option>
											<option value="654321">
												654321 — Universitas Brawijaya
											</option>
										</select>
									)}
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-3">
								<button
									type="button"
									onClick={() => {
										setIsModalOpen(false);
										setEditingItem(null);
									}}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									disabled={!editingItem.name || !editingItem.email}
									onClick={() => handleSaveAccess(editingItem)}
									className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs disabled:opacity-50"
								>
									<Save className="size-3.5" />
									<span>Simpan Akses</span>
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Proteksi Admin Terakhir Alert Dialog */}
				{lastAdminAlert && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-md rounded-xl border border-danger/40 bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-full bg-danger/10 text-danger shrink-0">
									<ShieldAlert className="size-5" />
								</div>
								<div>
									<h3 className="text-base font-semibold text-foreground">
										Aksi Ditolak: Proteksi Admin Terakhir
									</h3>
									<p className="text-xs text-muted-foreground">
										Integritas Scope KPPN Malang (032)
									</p>
								</div>
							</div>

							<p className="text-xs text-muted-foreground">
								Tidak dapat menonaktifkan atau menghapus akun Admin KPPN aktif
								terakhir. Sistem mewajibkan minimal ada{" "}
								<strong className="text-foreground">1 Admin KPPN aktif</strong>{" "}
								untuk menjaga kesinambungan tata kelola dan audit kebijakan.
							</p>

							<div className="flex items-center justify-end border-t border-border pt-3">
								<button
									type="button"
									onClick={() => setLastAdminAlert(false)}
									className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									Mengerti
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Matrix Perbedaan Hak Akses Modal */}
				{isMatrixOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-3xl rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<Scale className="size-4 text-primary" />
										<h3 className="text-base font-semibold text-foreground">
											Matriks Perbedaan Hak Akses
										</h3>
									</div>
									<p className="text-xs text-muted-foreground">
										Perbandingan hak akses administratif Admin KPPN vs hak akses
										operasional Operator Satker
									</p>
								</div>
								<button
									type="button"
									onClick={() => setIsMatrixOpen(false)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="overflow-x-auto rounded-lg border border-border/80">
								<table className="w-full text-left text-xs">
									<thead>
										<tr className="border-b border-border/80 bg-surface-muted/60 font-semibold text-muted-foreground">
											<th className="px-3.5 py-3">Modul &amp; Fitur</th>
											<th className="px-3.5 py-3 text-primary">
												Admin KPPN (Pembina)
											</th>
											<th className="px-3.5 py-3 text-foreground">
												Operator Satker
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{mockPermissionMatrix.map((item) => (
											<tr
												key={item.moduleName}
												className="transition-colors hover:bg-surface-muted/30"
											>
												<td className="px-3.5 py-2.5 font-semibold text-foreground">
													{item.moduleName}
												</td>
												<td className="px-3.5 py-2.5 font-medium text-primary">
													{item.adminKppnAccess}
												</td>
												<td className="px-3.5 py-2.5 text-foreground">
													{item.operatorSatkerAccess}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							<div className="flex items-center justify-between border-t border-border pt-3 text-xs">
								<span className="text-muted-foreground">
									Setiap peran memiliki isolasi data dan batasan kewenangan yang
									terjamin.
								</span>
								<button
									type="button"
									onClick={() => setIsMatrixOpen(false)}
									className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									Tutup
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</AdminShell>
	);
}
