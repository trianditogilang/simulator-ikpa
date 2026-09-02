import { relations } from "drizzle-orm";
import { auditLogs } from "./audit-logs";
import { budgets, dipaRevisions } from "./budget-revisions";
import { contracts } from "./contracts";
import { fiscalYears } from "./fiscal-years";
import { kppnScopes, organizations, userAccesses, users } from "./identity";
import { importJobs } from "./import-jobs";
import { kkpUsages } from "./kkp";
import { notificationDeliveries } from "./notification-deliveries";
import { outputReports } from "./output-reports";
import { reminderPolicies, ruleSets } from "./policy";
import { orgReminderConfigs } from "./reminder-configs";
import { realizations, rpdLines } from "./rpd-realizations";
import { scoreSnapshots } from "./score-snapshots";
import { simulationOverrides, simulations } from "./simulations";
import { spmLs } from "./spm-ls";
import { spmQ4 } from "./spm-q4";
import { workdays } from "./workdays";

export const kppnScopesRelations = relations(kppnScopes, ({ many }) => ({
	organizations: many(organizations),
	userAccesses: many(userAccesses),
}));

export const organizationsRelations = relations(
	organizations,
	({ one, many }) => ({
		kppnScope: one(kppnScopes, {
			fields: [organizations.kppnScopeId],
			references: [kppnScopes.id],
		}),
		userAccesses: many(userAccesses),
		fiscalYears: many(fiscalYears),
		orgReminderConfigs: many(orgReminderConfigs),
		notificationDeliveries: many(notificationDeliveries),
		importJobs: many(importJobs),
		auditLogs: many(auditLogs),
	}),
);

export const usersRelations = relations(users, ({ many }) => ({
	userAccesses: many(userAccesses, { relationName: "user_access_user" }),
	createdUserAccesses: many(userAccesses, {
		relationName: "user_access_creator",
	}),
	createdRuleSets: many(ruleSets),
	createdWorkdays: many(workdays),
	createdBudgets: many(budgets),
	createdDipaRevisions: many(dipaRevisions),
	createdRpdLines: many(rpdLines),
	createdRealizations: many(realizations),
	createdContracts: many(contracts),
	createdSpmLs: many(spmLs),
	createdUpTupTransactions: many(upTupTransactions),
	createdKkpUsages: many(kkpUsages),
	createdOutputReports: many(outputReports),
	createdSpmQ4: many(spmQ4),
	createdSimulations: many(simulations),
	createdScoreSnapshots: many(scoreSnapshots),
	updatedReminderConfigs: many(orgReminderConfigs),
	createdImportJobs: many(importJobs),
	auditLogs: many(auditLogs),
}));

import { upTupTransactions } from "./up-tup";

export const userAccessesRelations = relations(userAccesses, ({ one }) => ({
	user: one(users, {
		fields: [userAccesses.userId],
		references: [users.id],
		relationName: "user_access_user",
	}),
	organization: one(organizations, {
		fields: [userAccesses.orgId],
		references: [organizations.id],
	}),
	kppnScope: one(kppnScopes, {
		fields: [userAccesses.kppnScopeId],
		references: [kppnScopes.id],
	}),
	creator: one(users, {
		fields: [userAccesses.createdBy],
		references: [users.id],
		relationName: "user_access_creator",
	}),
}));

export const ruleSetsRelations = relations(ruleSets, ({ one, many }) => ({
	creator: one(users, {
		fields: [ruleSets.createdBy],
		references: [users.id],
	}),
	reminderPolicies: many(reminderPolicies),
	fiscalYears: many(fiscalYears),
	scoreSnapshots: many(scoreSnapshots),
}));

export const reminderPoliciesRelations = relations(
	reminderPolicies,
	({ one, many }) => ({
		ruleSet: one(ruleSets, {
			fields: [reminderPolicies.ruleSetId],
			references: [ruleSets.id],
		}),
		orgReminderConfigs: many(orgReminderConfigs),
		notificationDeliveries: many(notificationDeliveries),
		auditLogs: many(auditLogs),
	}),
);

export const workdaysRelations = relations(workdays, ({ one }) => ({
	creator: one(users, {
		fields: [workdays.createdBy],
		references: [users.id],
	}),
}));

export const fiscalYearsRelations = relations(fiscalYears, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [fiscalYears.orgId],
		references: [organizations.id],
	}),
	activeRuleSet: one(ruleSets, {
		fields: [fiscalYears.activeRuleSetId],
		references: [ruleSets.id],
	}),
	budgets: many(budgets),
	dipaRevisions: many(dipaRevisions),
	rpdLines: many(rpdLines),
	realizations: many(realizations),
	contracts: many(contracts),
	spmLs: many(spmLs),
	upTupTransactions: many(upTupTransactions),
	kkpUsages: many(kkpUsages),
	outputReports: many(outputReports),
	spmQ4: many(spmQ4),
	simulations: many(simulations),
	orgReminderConfigs: many(orgReminderConfigs),
	importJobs: many(importJobs),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [budgets.fiscalYearId],
		references: [fiscalYears.id],
	}),
	creator: one(users, {
		fields: [budgets.createdBy],
		references: [users.id],
	}),
}));

export const dipaRevisionsRelations = relations(dipaRevisions, ({ one }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [dipaRevisions.fiscalYearId],
		references: [fiscalYears.id],
	}),
	creator: one(users, {
		fields: [dipaRevisions.createdBy],
		references: [users.id],
	}),
}));

export const rpdLinesRelations = relations(rpdLines, ({ one }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [rpdLines.fiscalYearId],
		references: [fiscalYears.id],
	}),
	creator: one(users, {
		fields: [rpdLines.createdBy],
		references: [users.id],
	}),
}));

export const realizationsRelations = relations(realizations, ({ one }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [realizations.fiscalYearId],
		references: [fiscalYears.id],
	}),
	creator: one(users, {
		fields: [realizations.createdBy],
		references: [users.id],
	}),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [contracts.fiscalYearId],
		references: [fiscalYears.id],
	}),
	spmLs: many(spmLs),
	creator: one(users, {
		fields: [contracts.createdBy],
		references: [users.id],
	}),
}));

export const spmLsRelations = relations(spmLs, ({ one }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [spmLs.fiscalYearId],
		references: [fiscalYears.id],
	}),
	contract: one(contracts, {
		fields: [spmLs.contractId],
		references: [contracts.id],
	}),
	creator: one(users, {
		fields: [spmLs.createdBy],
		references: [users.id],
	}),
}));

export const upTupTransactionsRelations = relations(
	upTupTransactions,
	({ one }) => ({
		fiscalYear: one(fiscalYears, {
			fields: [upTupTransactions.fiscalYearId],
			references: [fiscalYears.id],
		}),
		creator: one(users, {
			fields: [upTupTransactions.createdBy],
			references: [users.id],
		}),
	}),
);

export const kkpUsagesRelations = relations(kkpUsages, ({ one }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [kkpUsages.fiscalYearId],
		references: [fiscalYears.id],
	}),
	creator: one(users, {
		fields: [kkpUsages.createdBy],
		references: [users.id],
	}),
}));

export const outputReportsRelations = relations(outputReports, ({ one }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [outputReports.fiscalYearId],
		references: [fiscalYears.id],
	}),
	creator: one(users, {
		fields: [outputReports.createdBy],
		references: [users.id],
	}),
}));

export const spmQ4Relations = relations(spmQ4, ({ one }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [spmQ4.fiscalYearId],
		references: [fiscalYears.id],
	}),
	creator: one(users, {
		fields: [spmQ4.createdBy],
		references: [users.id],
	}),
}));

export const simulationsRelations = relations(simulations, ({ one, many }) => ({
	fiscalYear: one(fiscalYears, {
		fields: [simulations.fiscalYearId],
		references: [fiscalYears.id],
	}),
	parentSnapshot: one(scoreSnapshots, {
		fields: [simulations.parentSnapshotId],
		references: [scoreSnapshots.id],
	}),
	overrides: many(simulationOverrides),
	snapshots: many(scoreSnapshots),
	creator: one(users, {
		fields: [simulations.createdBy],
		references: [users.id],
	}),
}));

export const simulationOverridesRelations = relations(
	simulationOverrides,
	({ one }) => ({
		simulation: one(simulations, {
			fields: [simulationOverrides.simulationId],
			references: [simulations.id],
		}),
	}),
);

export const scoreSnapshotsRelations = relations(scoreSnapshots, ({ one }) => ({
	simulation: one(simulations, {
		fields: [scoreSnapshots.simulationId],
		references: [simulations.id],
	}),
	ruleSet: one(ruleSets, {
		fields: [scoreSnapshots.ruleSetId],
		references: [ruleSets.id],
	}),
	creator: one(users, {
		fields: [scoreSnapshots.createdBy],
		references: [users.id],
	}),
}));

export const orgReminderConfigsRelations = relations(
	orgReminderConfigs,
	({ one }) => ({
		organization: one(organizations, {
			fields: [orgReminderConfigs.orgId],
			references: [organizations.id],
		}),
		fiscalYear: one(fiscalYears, {
			fields: [orgReminderConfigs.fiscalYearId],
			references: [fiscalYears.id],
		}),
		reminderPolicy: one(reminderPolicies, {
			fields: [orgReminderConfigs.reminderPolicyId],
			references: [reminderPolicies.id],
		}),
		updater: one(users, {
			fields: [orgReminderConfigs.updatedBy],
			references: [users.id],
		}),
	}),
);

export const notificationDeliveriesRelations = relations(
	notificationDeliveries,
	({ one }) => ({
		organization: one(organizations, {
			fields: [notificationDeliveries.orgId],
			references: [organizations.id],
		}),
		reminderPolicy: one(reminderPolicies, {
			fields: [notificationDeliveries.reminderPolicyId],
			references: [reminderPolicies.id],
		}),
	}),
);

export const importJobsRelations = relations(importJobs, ({ one }) => ({
	organization: one(organizations, {
		fields: [importJobs.orgId],
		references: [organizations.id],
	}),
	fiscalYear: one(fiscalYears, {
		fields: [importJobs.fiscalYearId],
		references: [fiscalYears.id],
	}),
	creator: one(users, {
		fields: [importJobs.createdBy],
		references: [users.id],
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
	organization: one(organizations, {
		fields: [auditLogs.orgId],
		references: [organizations.id],
	}),
	actor: one(users, {
		fields: [auditLogs.actorId],
		references: [users.id],
	}),
	policy: one(reminderPolicies, {
		fields: [auditLogs.policyId],
		references: [reminderPolicies.id],
	}),
}));
