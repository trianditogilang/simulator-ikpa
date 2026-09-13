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
	X,
} from "lucide-react";
import { useUser } from "@clerk/tanstack-react-start";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { mockPermissionMatrix } from "@/mocks/auth-presets";
import {
	assignAccess,
	fetchAdminUserAccesses,
	removeAccess,
} from "@/services/admin-access-service";

export const Route = createFileRoute("/admin-kppn/access")({
	loader: async () => {
		const accessData = await fetchAdminUserAccesses();
		return {
			accesses: accessData.accesses,
		};
	},
	component: AdminAccessManagementPage,
});

interface AccessRow {
	id: string;
	userId: string | null;
	name: string;
	email: string;
	accessType: "operator_satker" | "admin_kppn";
	accessTypeLabel: string;
	accessStatus: "active" | "pending";
	scopeCode: string;
	scopeName: string;
	adminSlot: number | null;
	status: "active" | "inactive" | "pending";
	createdAt: string;
}

function AdminAccessManagementPage() {
	const router = useRouter();
	const loaderData = Route.useLoaderData();

	const accessList: AccessRow[] = loaderData.accesses.map((a) => ({
		id: a.id,
		userId: a.userId,
		name: a.name ?? "",
		email: a.email ?? "",
		accessType: a.accessType,
		accessTypeLabel: a.accessType === "admin_kppn" ? "Admin KPPN" : "Operator Satker",
		accessStatus: a.accessStatus,
		scopeCode: a.scopeCode,
		scopeName: a.scopeName,
		adminSlot: a.adminSlot,
		status: a.status,
		createdAt: a.createdAt.slice(0, 10),
	}));
	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState<string>("all");
	const [editingItem, setEditingItem] = useState<AccessRow | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [toastIsError, setToastIsError] = useState(false);
	const [modalError, setModalError] = useState<string | null>(null);
	const [lastAdminAlert, setLastAdminAlert] = useState(false);
	const [isMatrixOpen, setIsMatrixOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<AccessRow | null>(null);
	const [kodeInput, setKodeInput] = useState("");
	const [satkerNameInput, setSatkerNameInput] = useState("");
	const [originalEmail, setOriginalEmail] = useState("");
	const [emailConfirmed, setEmailConfirmed] = useState(false);
	const [showEmailChangeConfirm, setShowEmailChangeConfirm] = useState(false);
	const [selfEmailChangeConfirmed, setSelfEmailChangeConfirmed] = useState(false);

	const activeAdminCount = accessList.filter((a) => a.accessType === "admin_kppn" && a.accessStatus === "active").length;

	let currentUserEmail: string | null = null;
	try {
		const { user, isLoaded } = useUser();
		if (isLoaded && user?.primaryEmailAddress?.emailAddress) {
			currentUserEmail = user.primaryEmailAddress.emailAddress.toLowerCase();
		} else if (isLoaded && user?.emailAddresses?.[0]?.emailAddress) {
			currentUserEmail = user.emailAddresses[0].emailAddress.toLowerCase();
		}
	} catch {}
	if (!currentUserEmail) {
		const demoAdmin = accessList.find((a) => a.accessType === "admin_kppn");
		if (demoAdmin) {
			currentUserEmail = demoAdmin.email.toLowerCase();
		}
	}
	const editingOriginalRow = isEditMode && editingItem
		? accessList.find((row) => row.id === editingItem.id) ?? null
		: null;
	const isEditingExistingAccess = Boolean(editingOriginalRow);
	const isEditingSelf = Boolean(
		currentUserEmail &&
		editingOriginalRow?.email &&
		editingOriginalRow.email.toLowerCase() === currentUserEmail,
	);

	const filteredList = useMemo(() => {
		return accessList.filter((item) => {
			const matchQuery =
				item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.scopeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.scopeCode.includes(searchQuery);
			const matchRole = roleFilter === "all" || item.accessType === roleFilter;
			return matchQuery && matchRole;
		});
	}, [accessList, searchQuery, roleFilter]);

	const sortedFilteredList = useMemo(() => {
		if (!currentUserEmail) return filteredList;
		const idx = filteredList.findIndex((u) => u.email.toLowerCase() === currentUserEmail);
		if (idx <= 0) return filteredList;
		const me = filteredList[idx];
		return [me, ...filteredList.slice(0, idx), ...filteredList.slice(idx + 1)];
	}, [filteredList, currentUserEmail]);

	const openAddModal = () => {
		setEditingItem({
			id: `acc-new-${Date.now()}`,
			userId: null,
			name: "",
			email: "",
			accessType: "operator_satker",
			accessTypeLabel: "Operator Satker",
			accessStatus: "active",
			scopeCode: "",
			scopeName: "",
			adminSlot: null,
			status: "active",
			createdAt: new Date().toISOString().slice(0, 10),
		});
		setKodeInput("");
		setSatkerNameInput("");
		setOriginalEmail("");
		setEmailConfirmed(false);
		setSelfEmailChangeConfirmed(false);
		setIsEditMode(false);
		setModalError(null);
		setIsModalOpen(true);
	};

	const openEditModal = (row: AccessRow) => {
		setEditingItem({ ...row });
		setKodeInput(row.accessType === "operator_satker" ? row.scopeCode : "");
		setSatkerNameInput(row.accessType === "operator_satker" ? row.scopeName : "");
		setOriginalEmail(row.email);
		setEmailConfirmed(false);
		setSelfEmailChangeConfirmed(false);
		setIsEditMode(true);
		setModalError(null);
		setIsModalOpen(true);
	};

	const handleSaveAccess = async () => {
		if (!editingItem) return;
		if (isEditMode && isEditingExistingAccess && editingItem.accessType !== editingOriginalRow?.accessType) {
			setModalError("Tipe akses tidak dapat diubah setelah pengguna terdaftar.");
			return;
		}
		const emailChanged = isEditMode && editingItem.email.trim().toLowerCase() !== originalEmail;
		if (emailChanged && !emailConfirmed) {
			setModalError("Centang konfirmasi perubahan email terlebih dahulu.");
			return;
		}
		if (emailChanged && isEditingSelf && !selfEmailChangeConfirmed) {
			setShowEmailChangeConfirm(true);
			return;
		}
		setModalError(null);
		setShowEmailChangeConfirm(false);
		try {
			await assignAccess({
				name: editingItem.name.trim() || editingItem.email.split("@")[0] || "User",
				email: editingItem.email.trim(),
				accessType: editingItem.accessType,
				kodeSatker: editingItem.accessType === "operator_satker" ? kodeInput.trim().toUpperCase() : null,
				satkerName: editingItem.accessType === "operator_satker" ? satkerNameInput.trim() : null,
				targetUserId: isEditMode ? editingItem.userId : null,
				targetAccessId: isEditMode ? editingItem.id : null,
				emailConfirmed,
			});
			setToastIsError(false);
			setToastMessage(`Akses "${editingItem.email}" berhasil disimpan.`);
			setIsModalOpen(false);
			setEditingItem(null);
			await router.invalidate();
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Gagal menyimpan akses.";
			const code = e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code ?? "") : "";
			const errorText = `${code} ${msg}`;
			if (errorText.includes("ORGANIZATION_NAME_MISMATCH") || msg.includes("Kode satker sudah terdaftar dengan nama berbeda")) {
				setModalError("Kode satker sudah terdaftar dengan nama berbeda.");
			} else if (errorText.includes("SATKER_OPERATOR_EXISTS") || errorText.includes("OPERATOR_ALREADY_EXISTS") || msg.includes("sudah memiliki operator aktif")) {
				setModalError("Satker sudah memiliki operator aktif.");
			} else if (errorText.includes("SATKER_ALREADY_REGISTERED")) {
				setModalError("Satker sudah terdaftar. Minta Admin KPPN memetakan akses.");
			} else if (errorText.includes("EMAIL_CONFIRM_REQUIRED") || msg.includes("Konfirmasi perubahan email")) {
				setModalError("Konfirmasi perubahan email diperlukan.");
			} else if (errorText.includes("ACCESS_TYPE_CONFLICT") || msg.includes("Jenis akses pengguna tidak dapat diubah") || msg.includes("Satu pengguna tidak boleh memiliki")) {
				setModalError("Tipe akses tidak dapat diubah setelah pengguna terdaftar.");
			} else if (errorText.includes("CLERK_SYNC_FAILED") || msg.includes("menyinkronkan perubahan user ke Clerk")) {
				setModalError("Perubahan belum disimpan karena gagal menyinkronkan data ke Clerk.");
			} else if (errorText.includes("CLERK_INVITATION_FAILED") || msg.includes("Undangan Clerk gagal dikirim")) {
				setModalError("Akses belum disimpan karena undangan Clerk gagal dikirim.");
			} else {
				setModalError(`Gagal menyimpan akses: ${msg}`);
			}
		}
		if (isModalOpen) {
			setTimeout(() => setModalError(null), 4000);
		} else {
			setTimeout(() => setToastMessage(null), 4000);
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		const isSelf = currentUserEmail ? deleteTarget.email.toLowerCase() === currentUserEmail : false;
		if (isSelf) {
			setToastIsError(true);
			setToastMessage("Tidak dapat menghapus akun Anda sendiri.");
			setTimeout(() => setToastMessage(null), 4000);
			setDeleteTarget(null);
			return;
		}
		if (deleteTarget.accessType === "admin_kppn" && activeAdminCount <= 1) {
			setLastAdminAlert(true);
			setDeleteTarget(null);
			return;
		}
		try {
			await removeAccess(deleteTarget.id, deleteTarget.userId);
			setToastIsError(false);
			setToastMessage(`Akun "${deleteTarget.email}" berhasil dihapus dari Clerk dan Neon.`);
			await router.invalidate();
		} catch (e) {
			setToastIsError(true);
			const msg = e instanceof Error ? e.message : "Gagal menghapus akses.";
			const code = e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code ?? "") : "";
			const errorText = `${code} ${msg}`;
			if (errorText.includes("CLERK_NOT_CONFIGURED")) {
				setToastMessage("Penghapusan dibatalkan: koneksi Clerk belum dikonfigurasi.");
			} else if (errorText.includes("CLERK_DELETE_FAILED") || msg.includes("menghapus akun user di Clerk")) {
				setToastMessage("Akun belum dihapus karena penghapusan di Clerk gagal.");
			} else if (errorText.includes("DATABASE_DELETE_FAILED")) {
				setToastMessage("Akun Clerk sudah dihapus, tetapi data Neon belum bersih. Ulangi penghapusan.");
			} else if (errorText.includes("SELF_DELETE_FORBIDDEN") || msg.includes("menghapus akun sendiri")) {
				setToastMessage("Tidak dapat menghapus akun Anda sendiri.");
			} else if (errorText.includes("LAST_ADMIN_PROTECTION") || msg.includes("admin terakhir")) {
				setToastMessage("Tidak dapat menghapus Admin KPPN aktif terakhir.");
			} else {
				setToastMessage(`Gagal menghapus akses: ${msg}`);
			}
		}
		setDeleteTarget(null);
		setTimeout(() => setToastMessage(null), 4000);
	};

	return (
		<AdminShell currentPath="/admin-kppn/access">
			<div className="space-y-6">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Manajemen Akses Pengguna</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">Kelola mapping izin akses Operator Satker dan Admin KPPN dalam lingkup KPPN Malang 032</p>
					</div>
					<div className="flex items-center gap-2">
						<button type="button" onClick={() => setIsMatrixOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs">
							<HelpCircle className="size-3.5 text-primary" />
							<span>Perbedaan Hak Akses</span>
						</button>
						<button type="button" onClick={openAddModal} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs">
							<Plus className="size-3.5" />
							<span>Tambah Akses</span>
						</button>
					</div>
				</div>

				{toastMessage && (
					<div className={`flex items-center justify-between rounded-xl border p-4 text-xs font-medium ${toastIsError ? "border-danger/30 bg-danger/10 text-danger" : "border-success/30 bg-success/10 text-success"}`}>
						<div className="flex items-center gap-2">
							{toastIsError ? <ShieldAlert className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
							<span>{toastMessage}</span>
						</div>
						<button type="button" onClick={() => setToastMessage(null)} className={toastIsError ? "text-danger hover:underline" : "text-success hover:underline"}>Tutup</button>
					</div>
				)}

				<div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs shadow-xs">
					<div className="flex items-center gap-2 text-foreground">
						<ShieldCheck className="size-4 text-primary shrink-0" />
						<span>Proteksi sistem menjamin <strong className="text-primary">minimal 1 Admin KPPN aktif</strong> selalu terdaftar.</span>
					</div>
					<span className="text-muted-foreground text-[11px] font-medium">Admin Aktif: {activeAdminCount}</span>
				</div>

				<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<input aria-label="Cari pengguna dan hak akses" type="text" placeholder="Cari email, kode satker, atau nama satker..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<select aria-label="Filter jenis hak akses" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none">
								<option value="all">Semua Jenis Akses</option>
								<option value="admin_kppn">Admin KPPN</option>
								<option value="operator_satker">Operator Satker</option>
							</select>
						</div>
					</div>
					<div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
						<span>Menampilkan <strong className="text-foreground">{sortedFilteredList.length}</strong> pengguna aktif{currentUserEmail ? " • Akun Anda terpin di atas" : ""}</span>
						{(searchQuery || roleFilter !== "all") && (
							<button type="button" onClick={() => { setSearchQuery(""); setRoleFilter("all"); }} className="font-semibold text-primary underline-offset-4 hover:underline">Reset Filter</button>
						)}
					</div>
				</div>

				<div className="rounded-xl border border-border/80 bg-surface shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border/80 bg-surface-muted/50 font-semibold text-muted-foreground">
									<th className="py-3 pl-4 pr-2">User Satker</th>
									<th className="px-3 py-3">Email</th>
									<th className="px-3 py-3">Jenis</th>
									<th className="py-3 pl-2 pr-4 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{sortedFilteredList.map((user) => {
									const isCurrentUser = currentUserEmail ? user.email.toLowerCase() === currentUserEmail : false;
									const isPending = user.accessStatus === "pending";
									return (
										<tr key={user.id} className={`transition-colors hover:bg-surface-muted/30 ${isCurrentUser ? "bg-primary/[0.06] border-b-2 border-primary/20" : ""} ${isPending ? "opacity-70" : ""}`}>
											<td className="py-3 pl-4 pr-2">
												<div className="flex flex-col">
													<span className="font-semibold text-foreground">
														{isPending
															? `Menunggu - ${user.email}`
															: user.accessType === "admin_kppn"
																? `Admin - ${user.name} - KPPN 032`
																: user.scopeName}
													</span>
													<span className="text-[11px] text-muted-foreground">
														{isPending
															? "Undangan Clerk dikirim"
															: user.accessType === "admin_kppn"
																? "KPPN 032"
																: `Kode: ${user.scopeCode}`}
													</span>
												</div>
											</td>
											<td className="px-3 py-3 font-medium text-foreground">
												{user.email}
												{isCurrentUser && <span className="ml-1.5 inline-flex rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">Anda</span>}
												{isPending && <span className="ml-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Menunggu</span>}
											</td>
											<td className="px-3 py-3">
												<span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${user.accessType === "admin_kppn" ? "bg-primary/10 text-primary" : "bg-surface-muted text-foreground"}`}>{user.accessType === "admin_kppn" ? "Admin KPPN" : "Operator"}</span>
											</td>
											<td className="py-3 pl-2 pr-4 text-right">
												<div className="flex items-center justify-end gap-1.5">
													{!isPending && (
														<>
															<button type="button" onClick={() => openEditModal(user)} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-surface-muted">
																<Edit className="size-3" />
																<span>Edit</span>
															</button>
															<button type="button" onClick={() => setDeleteTarget(user)} disabled={isCurrentUser} className={`rounded-md p-1 hover:bg-danger/10 hover:text-danger ${isCurrentUser ? "cursor-not-allowed opacity-40" : "text-muted-foreground"}`} title={isCurrentUser ? "Tidak dapat menghapus akun sendiri" : "Hapus Akses"}>
																<Trash2 className="size-3.5" />
															</button>
														</>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>

				{isModalOpen && editingItem && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-semibold text-foreground">{isEditMode ? "Edit Akses Pengguna" : "Tambah Akses Baru"}</h3>
									<p className="text-xs text-muted-foreground">KPPN Malang 032</p>
								</div>
								<button type="button" onClick={() => { setIsModalOpen(false); setEditingItem(null); setModalError(null); }} className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted">
									<X className="size-4" />
								</button>
							</div>
							<div className="space-y-3.5 text-xs">
								<div>
									<span className="text-muted-foreground block mb-1 font-medium">Nama</span>
									<input aria-label="Nama pengguna" type="text" value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} placeholder="Nama" className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none" />
								</div>
								<div>
									<span className="text-muted-foreground block mb-1 font-medium">Email Akun</span>
									<input aria-label="Email akun" type="email" required value={editingItem.email} onChange={(e) => { setEditingItem({ ...editingItem, email: e.target.value }); setModalError(null); setEmailConfirmed(false); }} placeholder="user@domain.com" className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none" />
								</div>
								{isEditMode && editingItem.email.trim().toLowerCase() !== originalEmail && (
									<div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 p-3">
										<input type="checkbox" id="email-confirm" checked={emailConfirmed} onChange={(e) => { setEmailConfirmed(e.target.checked); setModalError(null); }} className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary" />
										<label htmlFor="email-confirm" className="text-xs text-foreground leading-relaxed">
											Saya konfirmasi bahwa email ini adalah alamat yang benar dan akan digunakan untuk login.
										</label>
									</div>
								)}
								<div>
									<span className="text-muted-foreground block mb-1 font-medium">Jenis Hak Akses</span>
									<select aria-label="Jenis hak akses" value={editingItem.accessType} onChange={(e) => {
										const type = e.target.value as "operator_satker" | "admin_kppn";
										if (isEditingExistingAccess) return;
										setEditingItem({ ...editingItem, accessType: type });
									}} disabled={isEditingExistingAccess} className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none disabled:opacity-50">
										<option value="operator_satker">Operator Satker</option>
										<option value="admin_kppn">Admin KPPN</option>
									</select>
									{isEditingExistingAccess && <p className="mt-1 text-[11px] text-warning">Tipe akses dikunci setelah pengguna terdaftar.</p>}
								</div>
								{editingItem.accessType === "operator_satker" && (
									<>
										<div>
											<span className="text-muted-foreground block mb-1 font-medium">Kode Satker</span>
											<input aria-label="Kode satker" type="text" required value={kodeInput} onChange={(e) => setKodeInput(e.target.value.toUpperCase())} placeholder="Contoh: 411782" className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-mono text-foreground focus:border-primary focus:outline-none" />
										</div>
										<div>
											<span className="text-muted-foreground block mb-1 font-medium">Nama Satker</span>
											<input aria-label="Nama satker" type="text" required value={satkerNameInput} onChange={(e) => setSatkerNameInput(e.target.value)} placeholder="Contoh: Kantor Pelayanan Perbendaharaan Satker Contoh" className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none" />
										</div>
									</>
								)}

							</div>
							{modalError && (
								<div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
									<ShieldAlert className="mt-0.5 size-4 shrink-0" />
									<p>{modalError}</p>
								</div>
							)}
							<div className="flex items-center justify-end gap-2 border-t border-border pt-3">
								<button type="button" onClick={() => { setIsModalOpen(false); setEditingItem(null); setModalError(null); }} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted">Batal</button>
								<button type="button" disabled={!editingItem.email || (editingItem.accessType === "operator_satker" ? (!kodeInput.trim() || !satkerNameInput.trim()) : !editingItem.name.trim()) || (isEditMode && editingItem.email.trim().toLowerCase() !== originalEmail && !emailConfirmed)} onClick={handleSaveAccess} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs disabled:opacity-50">
									<Save className="size-3.5" />
									<span>Simpan Akses</span>
								</button>
							</div>
						</div>
					</div>
				)}

				{deleteTarget && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-full bg-danger/10 text-danger shrink-0"><ShieldAlert className="size-5" /></div>
								<div>
									<h3 className="text-base font-semibold text-foreground">Hapus Akun Pengguna Permanen?</h3>
									<p className="text-xs text-muted-foreground">Akun Clerk, data Neon, mapping akses, dan riwayat simulasi akan dihapus permanen.</p>
								</div>
							</div>
							<div className="rounded-lg bg-surface-muted/50 border border-border p-3 text-xs">
								<p className="font-semibold text-foreground">{deleteTarget.email}</p>
								<p className="text-muted-foreground">{deleteTarget.accessType === "admin_kppn" ? `Admin - ${deleteTarget.name} - KPPN 032` : `${deleteTarget.scopeCode} • ${deleteTarget.scopeName}`} </p>
							</div>
							<div className="flex items-center justify-end gap-2 border-t border-border pt-3">
								<button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted">Batal</button>
								<button type="button" onClick={handleDelete} className="rounded-lg bg-danger px-4 py-2 text-xs font-semibold text-white hover:bg-danger/90 shadow-xs">Hapus Permanen</button>
							</div>
						</div>
					</div>
				)}

				{lastAdminAlert && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-md rounded-xl border border-danger/40 bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-full bg-danger/10 text-danger shrink-0"><ShieldAlert className="size-5" /></div>
								<div>
									<h3 className="text-base font-semibold text-foreground">Aksi Ditolak: Proteksi Admin Terakhir</h3>
									<p className="text-xs text-muted-foreground">Integritas Scope KPPN Anda</p>
								</div>
							</div>
							<p className="text-xs text-muted-foreground">Tidak dapat menghapus akun Admin KPPN aktif terakhir. Sistem mewajibkan minimal ada <strong className="text-foreground">1 Admin KPPN aktif</strong> untuk menjaga kesinambungan tata kelola.</p>
							<div className="flex items-center justify-end border-t border-border pt-3">
								<button type="button" onClick={() => setLastAdminAlert(false)} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs">Mengerti</button>
							</div>
						</div>
					</div>
				)}

				{showEmailChangeConfirm && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-md rounded-xl border border-warning/40 bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-full bg-warning/10 text-warning shrink-0"><ShieldAlert className="size-5" /></div>
								<div>
									<h3 className="text-base font-semibold text-foreground">Ubah Email Sendiri?</h3>
									<p className="text-xs text-muted-foreground">Anda mengubah email akun sendiri</p>
								</div>
							</div>
							<p className="text-xs text-muted-foreground">Mengubah email akun sendiri akan <strong className="text-foreground">mengakhiri sesi login saat ini</strong>. Anda perlu login kembali dengan email baru. Lanjutkan?</p>
							<div className="flex items-center justify-end gap-2 border-t border-border pt-3">
								<button type="button" onClick={() => setShowEmailChangeConfirm(false)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted">Batal</button>
								<button type="button" onClick={() => { setShowEmailChangeConfirm(false); setSelfEmailChangeConfirmed(true); setTimeout(() => handleSaveAccess(), 0); }} className="rounded-lg bg-warning px-4 py-2 text-xs font-semibold text-white hover:bg-warning/90 shadow-xs">Ya, Lanjutkan</button>
							</div>
						</div>
					</div>
				)}

				{isMatrixOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-3xl rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<div className="flex items-center gap-2"><Scale className="size-4 text-primary" /><h3 className="text-base font-semibold text-foreground">Matriks Perbedaan Hak Akses</h3></div>
									<p className="text-xs text-muted-foreground">Perbandingan hak akses administratif Admin KPPN vs hak akses operasional Operator Satker</p>
								</div>
								<button type="button" onClick={() => setIsMatrixOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"><X className="size-4" /></button>
							</div>
							<div className="overflow-x-auto rounded-lg border border-border/80">
								<table className="w-full text-left text-xs">
									<thead><tr className="border-b border-border/80 bg-surface-muted/60 font-semibold text-muted-foreground"><th className="px-3.5 py-3">Modul &amp; Fitur</th><th className="px-3.5 py-3 text-primary">Admin KPPN (Pembina)</th><th className="px-3.5 py-3 text-foreground">Operator Satker</th></tr></thead>
									<tbody className="divide-y divide-border/60">{mockPermissionMatrix.map((item) => (<tr key={item.moduleName} className="transition-colors hover:bg-surface-muted/30"><td className="px-3.5 py-2.5 font-semibold text-foreground">{item.moduleName}</td><td className="px-3.5 py-2.5 font-medium text-primary">{item.adminKppnAccess}</td><td className="px-3.5 py-2.5 text-foreground">{item.operatorSatkerAccess}</td></tr>))}</tbody>
								</table>
							</div>
							<div className="flex items-center justify-between border-t border-border pt-3 text-xs">
								<span className="text-muted-foreground">Setiap peran memiliki isolasi data dan batasan kewenangan yang terjamin.</span>
								<button type="button" onClick={() => setIsMatrixOpen(false)} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs">Tutup</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</AdminShell>
	);
}
