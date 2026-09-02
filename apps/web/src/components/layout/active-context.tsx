import { ContextHeader } from "@ikpa/ui";
import type {
	AccessResolution,
	FiscalPeriod,
	GlobalContext,
} from "@simulator-ikpa/contracts";
import { globalContextSchema } from "@simulator-ikpa/contracts";
import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";

const FISCAL_YEAR = 2026;
const FISCAL_YEAR_ID = "55555555-5555-4555-8555-555555555555";
const fiscalYearOptions = [FISCAL_YEAR] as const;
const fiscalPeriodOptions: readonly FiscalPeriod[] = Array.from(
	{ length: 12 },
	(_, index) => ({ kind: "month", value: index + 1 }),
);
const initialFiscalPeriod: FiscalPeriod = { kind: "month", value: 1 };

type ActiveContextValue = {
	context: GlobalContext;
	yearOptions: readonly number[];
	periodOptions: readonly FiscalPeriod[];
	setPeriod: (period: FiscalPeriod) => void;
};

const ActiveContext = createContext<ActiveContextValue | null>(null);

function getActiveOrganization(access: AccessResolution) {
	if (
		access.status !== "operator_single_scope" &&
		access.status !== "operator_multiple_scopes"
	) {
		return null;
	}

	return (
		access.organizations.find(
			(organization) => organization.id === access.activeOrganizationId,
		) ?? null
	);
}

function getActiveKppnScope(access: AccessResolution) {
	return access.status === "admin" ? (access.kppnScopes[0] ?? null) : null;
}

export function ActiveContextProvider({
	access,
	children,
}: {
	access: AccessResolution;
	children: ReactNode;
}) {
	const [period, setPeriod] = useState(initialFiscalPeriod);
	const activeOrganization = getActiveOrganization(access);
	const activeKppnScope = getActiveKppnScope(access);
	const context = useMemo(
		() =>
			globalContextSchema.parse({
				access,
				activeOrganization,
				activeKppnScope,
				fiscalYear: { id: FISCAL_YEAR_ID, year: FISCAL_YEAR },
				period,
				ruleSet: null,
				timezone: activeOrganization?.timezone ?? "Asia/Jakarta",
				generatedAt: new Date().toISOString(),
			}),
		[access, activeKppnScope, activeOrganization, period],
	);

	return (
		<ActiveContext.Provider
			value={{
				context,
				yearOptions: fiscalYearOptions,
				periodOptions: fiscalPeriodOptions,
				setPeriod,
			}}
		>
			{children}
		</ActiveContext.Provider>
	);
}

export function ActiveContextHeader() {
	const value = useContext(ActiveContext);
	if (!value) {
		return null;
	}

	return (
		<ContextHeader
			context={value.context}
			yearOptions={value.yearOptions}
			periodOptions={value.periodOptions}
			onPeriodChange={value.setPeriod}
		/>
	);
}

export function useActiveContext() {
	return useContext(ActiveContext);
}
