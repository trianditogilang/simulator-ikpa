import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export interface ColumnDef<T> {
	key: string;
	header: string;
	className?: string;
	render: (item: T) => ReactNode;
}

export interface DomainDataTableProps<T> extends ComponentProps<"div"> {
	title: string;
	description?: string;
	data: T[];
	columns: ColumnDef<T>[];
	isLoading?: boolean;
	emptyMessage?: string;
	searchValue?: string;
	onSearchChange?: (val: string) => void;
	onAddClick?: () => void;
	onImportClick?: () => void;
	totalCount?: number;
}

export function DomainDataTable<T extends { id: string | number }>({
	title,
	description,
	data,
	columns,
	isLoading,
	emptyMessage = "Belum ada data tersedia.",
	searchValue,
	onSearchChange,
	onAddClick,
	onImportClick,
	totalCount,
	className,
	...props
}: DomainDataTableProps<T>) {
	return (
		<div
			{...props}
			className={twMerge("space-y-4 rounded-2xl border border-border bg-background p-4 shadow-xs sm:p-6", className)}
			data-slot="domain-data-table"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-base font-bold text-foreground sm:text-lg">{title}</h2>
					{description && (
						<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
					)}
				</div>

				<div className="flex items-center gap-2">
					{onImportClick && (
						<button
							type="button"
							onClick={onImportClick}
							className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
						>
							Import
						</button>
					)}
					{onAddClick && (
						<button
							type="button"
							onClick={onAddClick}
							className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover"
						>
							+ Tambah Data
						</button>
					)}
				</div>
			</div>

			{/* Search toolbar */}
			{onSearchChange && (
				<div className="flex items-center justify-between gap-3">
					<input
						type="text"
						value={searchValue ?? ""}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder="Cari data..."
						className="max-w-xs rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
					/>
					{totalCount !== undefined && (
						<span className="text-xs text-muted-foreground">{totalCount} Data</span>
					)}
				</div>
			)}

			{/* Data Table */}
			<div className="overflow-x-auto rounded-xl border border-border/80">
				<table className="w-full text-left text-xs">
					<thead className="border-b border-border/80 bg-surface text-muted-foreground">
						<tr>
							{columns.map((col) => (
								<th key={col.key} className={twMerge("px-4 py-2.5 font-semibold", col.className)}>
									{col.header}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-border/60 bg-background text-foreground">
						{isLoading ? (
							<tr>
								<td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
									Memuat data...
								</td>
							</tr>
						) : data.length === 0 ? (
							<tr>
								<td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
									{emptyMessage}
								</td>
							</tr>
						) : (
							data.map((item) => (
								<tr key={item.id} className="transition hover:bg-surface-muted/50">
									{columns.map((col) => (
										<td key={col.key} className={twMerge("px-4 py-2.5", col.className)}>
											{col.render(item)}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
