import {
	AlertOctagon,
	CheckSquare2,
	CreditCard,
	FileSpreadsheet,
	Layers,
	Percent,
	Receipt,
	Scale,
} from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type IndicatorSummaryProps = ComponentProps<"div">;

const INDICATORS = [
	{
		id: "revisi-dipa",
		name: "Revisi DIPA",
		weight: "10%",
		aspect: "Kualitas Perencanaan Anggaran",
		icon: FileSpreadsheet,
		desc: "Maksimal 1 kali revisi per triwulan untuk pagu tetap/pergeseran akun.",
	},
	{
		id: "deviasi-hal-iii",
		name: "Deviasi Halaman III DIPA",
		weight: "15%",
		aspect: "Kualitas Perencanaan Anggaran",
		icon: Layers,
		desc: "Kesesuaian realisasi anggaran bulanan terhadap Rencana Penarikan Dana (RPD).",
	},
	{
		id: "penyerapan",
		name: "Penyerapan Anggaran",
		weight: "20%",
		aspect: "Kualitas Pelaksanaan Anggaran",
		icon: Percent,
		desc: "Pencapaian target serapan anggaran per triwulan per jenis belanja.",
	},
	{
		id: "belanja-kontraktual",
		name: "Belanja Kontraktual",
		weight: "10%",
		aspect: "Kualitas Pelaksanaan Anggaran",
		icon: Scale,
		desc: "Pendaftaran kontrak tepat waktu (≤ 3 hari kerja) dan akselerasi kontrak dini.",
	},
	{
		id: "penyelesaian-tagihan",
		name: "Penyelesaian Tagihan",
		weight: "10%",
		aspect: "Kualitas Pelaksanaan Anggaran",
		icon: Receipt,
		desc: "Ketepatan waktu penerbitan SPM-LS non-belanja pegawai (≤ 17 hari kerja).",
	},
	{
		id: "up-tup-kkp",
		name: "Pengelolaan UP/TUP & KKP",
		weight: "10%",
		aspect: "Kualitas Pelaksanaan Anggaran",
		icon: CreditCard,
		desc: "Revolving UP bulanan tepat waktu, setoran sisa TUP, dan proporsi transaksi KKP.",
	},
	{
		id: "capaian-output",
		name: "Capaian Output",
		weight: "25%",
		aspect: "Kualitas Hasil Pelaksanaan Anggaran",
		icon: CheckSquare2,
		desc: "Ketepatan waktu pelaporan dan pencapaian target rincian output bulanan.",
	},
	{
		id: "dispensasi-spm",
		name: "Dispensasi SPM",
		weight: "Pengurang",
		aspect: "Faktor Pengurang",
		icon: AlertOctagon,
		desc: "Pengurang nilai maksimal 5 poin akibat pengajuan SPM dispensasi pada akhir tahun anggaran (Q4).",
	},
];

export function IndicatorSummary({ className, ...props }: IndicatorSummaryProps) {
	return (
		<div
			{...props}
			className={twMerge(
				"grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
				className,
			)}
			data-slot="indicator-summary"
		>
			{INDICATORS.map((indicator) => {
				const Icon = indicator.icon;
				const isDeduction = indicator.weight === "Pengurang";

				return (
					<div
						key={indicator.id}
						className={twMerge(
							"group relative flex flex-col justify-between rounded-2xl border bg-background p-5 transition-all hover:shadow-md",
							isDeduction
								? "border-danger/30 hover:border-danger/60 bg-danger/[0.02]"
								: "border-border hover:border-primary/40",
						)}
					>
						<div>
							<div className="flex items-center justify-between">
								<div
									className={twMerge(
										"inline-flex h-9 w-9 items-center justify-center rounded-xl",
										isDeduction
											? "bg-danger/10 text-danger"
											: "bg-primary/10 text-primary",
									)}
								>
									<Icon className="h-4 w-4" />
								</div>
								<span
									className={twMerge(
										"rounded-md px-2 py-0.5 font-mono text-xs font-semibold",
										isDeduction
											? "bg-danger/10 text-danger"
											: "bg-surface-muted text-foreground",
									)}
								>
									{indicator.weight}
								</span>
							</div>

							<div className="mt-3.5 space-y-1">
								<h3 className="text-sm font-semibold text-foreground">
									{indicator.name}
								</h3>
								<p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
									{indicator.desc}
								</p>
							</div>
						</div>

						<div className="mt-4 border-t border-border/60 pt-2 text-[11px] font-medium text-muted-foreground">
							{indicator.aspect}
						</div>
					</div>
				);
			})}
		</div>
	);
}
