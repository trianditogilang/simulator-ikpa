import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";
import { IncompleteState } from "./incomplete-state";
import { PolicyLockAlert } from "./policy-lock-alert";
import { SimulationDisclaimer } from "./simulation-disclaimer";
import { StatusBadge } from "./status-badge";
import { RuleSetBadge } from "./rule-set-badge";

export default {
	title: "System States",
};

export const Loading = () => <LoadingState label="Memuat Data Simulasi..." />;

export const ErrorView = () => (
	<ErrorState
		title="Gagal Memuat Indikator"
		description="Koneksi ke server terputus. Silakan coba lagi beberapa saat kemudian."
		onRetry={() => {}}
		requestId="REQ-998877"
	/>
);

export const Empty = () => (
	<EmptyState
		title="Tidak Ada Data Revisi"
		description="Belum ada usulan revisi DIPA pada periode ini."
		domain="Revisi DIPA"
		actionLabel="Tambah Usulan"
		onAction={() => {}}
	/>
);

export const Incomplete = () => (
	<IncompleteState
		domain="Pagu & Revisi"
		title="Parameter Belum Lengkap"
		description="Lengkapi data berikut untuk melanjutkan simulasi."
		items={[
			"Pagu awal belum direkam",
			"Data capaian output bulan lalu belum dikonfirmasi",
		]}
		actionLabel="Lengkapi Data"
		onAction={() => {}}
	/>
);

export const PolicyLocked = () => (
	<PolicyLockAlert
		reason="Periode bulan berjalan telah ditutup oleh kalender kerja KPPN."
		lockedFields={["Nilai Transaksi UP", "Tanggal BAST"]}
	/>
);

export const Disclaimer = () => <SimulationDisclaimer />;

export const Status = () => (
	<div className="flex gap-4">
		<StatusBadge status="complete" />
		<StatusBadge status="warning" />
		<StatusBadge status="danger" />
	</div>
);

export const RuleSet = () => (
	<div className="flex gap-4">
		<RuleSetBadge year={2026} version={1} status="published" />
		<RuleSetBadge year={2026} version={2} status="retired" />
	</div>
);
