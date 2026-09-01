import { Building2, Check, Search, SearchX } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { twMerge } from "tailwind-merge";

type Organization = {
	code: string;
	name: string;
	kppn: string;
	location: string;
};

const mockOrganizations: readonly Organization[] = [
	{
		code: "123456",
		name: "Satker Pelayanan Anggaran A",
		kppn: "KPPN Jakarta I",
		location: "Jakarta Pusat",
	},
	{
		code: "789012",
		name: "Satker Pelayanan Anggaran B",
		kppn: "KPPN Jakarta II",
		location: "Jakarta Selatan",
	},
	{
		code: "345678",
		name: "Satker Pelayanan Anggaran C",
		kppn: "KPPN Bandung",
		location: "Bandung",
	},
];

export type OrgPickerProps = Omit<ComponentProps<"section">, "children">;

export function OrgPicker({ className, ...props }: OrgPickerProps) {
	const [query, setQuery] = useState("");
	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const [isConfirmed, setIsConfirmed] = useState(false);

	const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
	const filteredOrganizations = mockOrganizations.filter((organization) => {
		if (!normalizedQuery) {
			return true;
		}

		return [
			organization.code,
			organization.name,
			organization.kppn,
			organization.location,
		].some((value) =>
			value.toLocaleLowerCase("id-ID").includes(normalizedQuery),
		);
	});
	const selectedOrganization = mockOrganizations.find(
		(organization) => organization.code === selectedCode,
	);

	const handleSelect = (code: string) => {
		setSelectedCode(code);
		setIsConfirmed(false);
	};

	return (
		<section
			{...props}
			aria-labelledby="org-picker-heading"
			className={twMerge("w-full max-w-2xl self-center", className)}
			data-slot="org-picker"
		>
			<div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
				<div className="flex items-start gap-3">
					<div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<Building2 aria-hidden="true" className="size-5" />
					</div>
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
							Konteks kerja
						</p>
						<h1
							className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
							id="org-picker-heading"
						>
							Pilih satker
						</h1>
					</div>
				</div>

				<p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
					Email Anda memiliki akses ke beberapa satker. Pilih satu konteks kerja
					untuk melanjutkan ke area Operator Satker.
				</p>

				<div className="mt-6 space-y-1.5">
					<label
						className="block text-xs font-semibold text-foreground"
						htmlFor="organization-search"
					>
						Cari satker
					</label>
					<div className="relative">
						<Search
							aria-hidden="true"
							className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<input
							aria-controls="organization-options"
							className="min-h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							id="organization-search"
							name="organization-search"
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Cari kode atau nama satker"
							type="search"
							value={query}
						/>
					</div>
				</div>

				<div
					aria-label="Daftar satker"
					className="mt-4 space-y-3"
					id="organization-options"
					role="listbox"
				>
					{filteredOrganizations.length > 0 ? (
						filteredOrganizations.map((organization) => {
							const isSelected = organization.code === selectedCode;

							return (
								<button
									aria-selected={isSelected}
									className={twMerge(
										"flex min-h-20 w-full items-center gap-3 rounded-xl border bg-background p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99]",
										isSelected
											? "border-primary bg-primary/5 ring-1 ring-primary/20"
											: "border-border hover:border-primary/40 hover:bg-surface",
									)}
									key={organization.code}
									onClick={() => handleSelect(organization.code)}
									role="option"
									type="button"
								>
									<span
										aria-hidden="true"
										className={twMerge(
											"inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground",
											isSelected && "bg-primary text-primary-foreground",
										)}
									>
										{isSelected ? (
											<Check aria-hidden="true" className="size-4" />
										) : (
											<Building2 aria-hidden="true" className="size-4" />
										)}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold text-foreground">
											{organization.code} — {organization.name}
										</span>
										<span className="mt-1 block truncate text-xs text-muted-foreground">
											{organization.kppn} · {organization.location}
										</span>
									</span>
									<span
										className={twMerge(
											"hidden shrink-0 text-xs font-semibold text-muted-foreground sm:inline",
											isSelected && "text-primary",
										)}
									>
										{isSelected ? "Dipilih" : "Pilih"}
									</span>
								</button>
							);
						})
					) : (
						<div
							aria-live="polite"
							className="rounded-xl border border-dashed border-border bg-surface p-6 text-center"
						>
							<SearchX
								aria-hidden="true"
								className="mx-auto size-8 text-muted-foreground"
							/>
							<h2 className="mt-3 text-base font-semibold text-foreground">
								Satker tidak ditemukan
							</h2>
							<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
								Coba gunakan kode atau nama satker yang berbeda.
							</p>
							<button
								className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
								onClick={() => setQuery("")}
								type="button"
							>
								Tampilkan semua satker
							</button>
						</div>
					)}
				</div>

				<div className="mt-5 border-t border-border pt-5">
					{selectedOrganization ? (
						<div
							aria-live="polite"
							className="mb-4 rounded-lg border border-info/30 bg-info-surface px-3 py-2.5 text-xs text-info"
						>
							<strong>Satker aktif:</strong> {selectedOrganization.code} —{" "}
							{selectedOrganization.name}
							{isConfirmed ? " (simulasi siap dilanjutkan)" : ""}
						</div>
					) : (
						<p className="mb-4 text-xs text-muted-foreground">
							Pilih satu satker untuk mengaktifkan konteks kerja.
						</p>
					)}
					<button
						className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!selectedOrganization}
						onClick={() => setIsConfirmed(true)}
						type="button"
					>
						Gunakan satker terpilih
					</button>
				</div>

				<div className="mt-5 border-t border-border pt-4 text-center">
					<p className="text-xs leading-relaxed text-muted-foreground">
						Pilihan ini hanya untuk simulasi UI dan belum mengubah konteks sesi
						nyata.
					</p>
					<Link
						className="mt-3 inline-block text-xs font-medium text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						search={{ next: "/select-organization" }}
						to="/sign-in"
					>
						Kembali ke halaman login
					</Link>
				</div>
			</div>
		</section>
	);
}
