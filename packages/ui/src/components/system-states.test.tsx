import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { EmptyState } from "./empty-state";
import { IncompleteState } from "./incomplete-state";
import { PolicyLockAlert } from "./policy-lock-alert";
import { SimulationDisclaimer } from "./simulation-disclaimer";
import { StatusBadge } from "./status-badge";
import { RuleSetBadge } from "./rule-set-badge";

describe("System States Components", () => {
	it("LoadingState renders skeleton with label", () => {
		const { container } = render(<LoadingState label="Memuat Data Simulasi" rows={4} />);
		expect(screen.getByText("Memuat Data Simulasi")).toBeDefined();
		expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
	});

	it("ErrorState renders error description, request ID, and retry button", () => {
		const onRetry = vi.fn();
		render(
			<ErrorState
				title="Gagal Memuat"
				description="Terjadi kesalahan jaringan"
				onRetry={onRetry}
				requestId="REQ-123"
				retryLabel="Coba Lagi"
			/>,
		);
		expect(screen.getByText("Gagal Memuat")).toBeDefined();
		expect(screen.getByText("Terjadi kesalahan jaringan")).toBeDefined();
		expect(screen.getByText("REQ-123")).toBeDefined();
		expect(screen.getByText("Coba Lagi")).toBeDefined();
	});

	it("EmptyState renders icon, title, description, and action buttons", () => {
		const onAction = vi.fn();
		const onSecondary = vi.fn();
		render(
			<EmptyState
				title="Tidak Ada Data"
				description="Belum ada transaksi bulan ini"
				domain="Simulasi"
				actionLabel="Tambah Data"
				onAction={onAction}
				secondaryActionLabel="Import CSV"
				onSecondaryAction={onSecondary}
			/>,
		);
		expect(screen.getByText("Tidak Ada Data")).toBeDefined();
		expect(screen.getByText("Belum ada transaksi bulan ini")).toBeDefined();
		expect(screen.getByText("Simulasi")).toBeDefined();
		expect(screen.getByText("Tambah Data")).toBeDefined();
		expect(screen.getByText("Import CSV")).toBeDefined();
	});

	it("IncompleteState renders missing items and domain", () => {
		const onAction = vi.fn();
		render(
			<IncompleteState
				domain="Pagu & Revisi"
				title="Data Belum Lengkap"
				description="Beberapa data wajib belum diinput."
				items={["Target Penerimaan", "Pagu Belanja"]}
				actionLabel="Lengkapi Data"
				onAction={onAction}
			/>,
		);
		expect(screen.getByText("Pagu & Revisi")).toBeDefined();
		expect(screen.getByText("Data Belum Lengkap")).toBeDefined();
		expect(screen.getByText("Target Penerimaan")).toBeDefined();
		expect(screen.getByText("Pagu Belanja")).toBeDefined();
		expect(screen.getByText("Lengkapi Data")).toBeDefined();
	});

	it("PolicyLockAlert renders locked fields and reason", () => {
		render(
			<PolicyLockAlert
				reason="Target bulan ini sudah dikunci"
				lockedFields={["Nilai RPD", "Realisasi"]}
			/>,
		);
		expect(screen.getByText("Target bulan ini sudah dikunci")).toBeDefined();
		expect(screen.getByText("Nilai RPD")).toBeDefined();
		expect(screen.getByText("Realisasi")).toBeDefined();
	});

	it("SimulationDisclaimer renders default disclaimer text", () => {
		render(<SimulationDisclaimer />);
		expect(
			screen.getByText("Simulasi internal, bukan nilai resmi OMSPAN/KPPN."),
		).toBeDefined();
	});

	it("StatusBadge renders correct status and accessible name", () => {
		render(<StatusBadge status="complete" />);
		expect(screen.getByText("Aman / Lengkap")).toBeDefined();
	});

	it("RuleSetBadge renders year, version, and status", () => {
		render(<RuleSetBadge year={2026} version={1} status="published" />);
		expect(screen.getByText("Rule Set 2026.1")).toBeDefined();
		expect(screen.getByText("Published")).toBeDefined();
	});
});
