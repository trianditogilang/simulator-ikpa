import { describe, expect, it } from "vitest";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import {
	ForbiddenError,
	UnauthorizedError,
	assertAdminKppnScope,
	assertAuthenticated,
	assertOperatorOrgScope,
} from "./scope-guard";

const mockUserId = "11111111-1111-4111-8111-111111111111";
const mockOrgId1 = "22222222-2222-4222-8222-222222222222";
const mockOrgId2 = "33333333-3333-4333-8333-333333333333";
const mockScopeId1 = "44444444-4444-4444-8444-444444444444";
const mockScopeId2 = "55555555-5555-4555-8555-555555555555";

describe("scope-guard", () => {
	describe("assertAuthenticated", () => {
		it("throws UnauthorizedError for unauthenticated status", () => {
			expect(() =>
				assertAuthenticated({ status: "unauthenticated" }),
			).toThrow(UnauthorizedError);
		});

		it("returns userId for valid session", () => {
			const res = assertAuthenticated({
				status: "unmapped",
				userId: mockUserId,
			});
			expect(res.userId).toBe(mockUserId);
		});
	});

	describe("assertOperatorOrgScope", () => {
		it("throws UnauthorizedError when unauthenticated", () => {
			expect(() =>
				assertOperatorOrgScope(
					{ status: "unauthenticated" },
					mockOrgId1,
				),
			).toThrow(UnauthorizedError);
		});

		it("throws ForbiddenError when unmapped or conflict", () => {
			expect(() =>
				assertOperatorOrgScope(
					{ status: "unmapped", userId: mockUserId },
					mockOrgId1,
				),
			).toThrow(ForbiddenError);

			expect(() =>
				assertOperatorOrgScope(
					{
						status: "invalid_conflict",
						userId: mockUserId,
						code: "ACCESS_MAPPING_CONFLICT",
					},
					mockOrgId1,
				),
			).toThrow(ForbiddenError);
		});

		it("throws ForbiddenError when Admin tries to access operator scope", () => {
			const adminRes: AccessResolution = {
				status: "admin",
				userId: mockUserId,
				accessType: "admin_kppn",
				kppnScopes: [{ id: mockScopeId1, code: "089", name: "KPPN Jakarta II" }],
			};
			expect(() => assertOperatorOrgScope(adminRes, mockOrgId1)).toThrow(
				ForbiddenError,
			);
		});

		it("allows Operator access to authorized orgId", () => {
			const opRes: AccessResolution = {
				status: "operator_single_scope",
				userId: mockUserId,
				accessType: "operator_satker",
				organizations: [
					{
						id: mockOrgId1,
						code: "411782",
						name: "Satker Contoh",
						timezone: "Asia/Jakarta",
					},
				],
				activeOrganizationId: mockOrgId1,
			};
			const ctx = assertOperatorOrgScope(opRes, mockOrgId1);
			expect(ctx).toEqual({ userId: mockUserId, orgId: mockOrgId1 });
		});

		it("throws ForbiddenError when Operator accesses unauthorized orgId", () => {
			const opRes: AccessResolution = {
				status: "operator_single_scope",
				userId: mockUserId,
				accessType: "operator_satker",
				organizations: [
					{
						id: mockOrgId1,
						code: "411782",
						name: "Satker Contoh",
						timezone: "Asia/Jakarta",
					},
				],
				activeOrganizationId: mockOrgId1,
			};
			expect(() => assertOperatorOrgScope(opRes, mockOrgId2)).toThrow(
				ForbiddenError,
			);
		});
	});

	describe("assertAdminKppnScope", () => {
		it("throws UnauthorizedError when unauthenticated", () => {
			expect(() =>
				assertAdminKppnScope({ status: "unauthenticated" }),
			).toThrow(UnauthorizedError);
		});

		it("throws ForbiddenError when Operator tries to access Admin scope", () => {
			const opRes: AccessResolution = {
				status: "operator_single_scope",
				userId: mockUserId,
				accessType: "operator_satker",
				organizations: [
					{
						id: mockOrgId1,
						code: "411782",
						name: "Satker Contoh",
						timezone: "Asia/Jakarta",
					},
				],
				activeOrganizationId: mockOrgId1,
			};
			expect(() => assertAdminKppnScope(opRes)).toThrow(ForbiddenError);
		});

		it("allows Admin access without specific target scope", () => {
			const adminRes: AccessResolution = {
				status: "admin",
				userId: mockUserId,
				accessType: "admin_kppn",
				kppnScopes: [
					{ id: mockScopeId1, code: "089", name: "KPPN Jakarta II" },
					{ id: mockScopeId2, code: "090", name: "KPPN Jakarta III" },
				],
			};
			const ctx = assertAdminKppnScope(adminRes);
			expect(ctx).toEqual({
				userId: mockUserId,
				allowedKppnScopeIds: [mockScopeId1, mockScopeId2],
			});
		});

		it("allows Admin access with authorized target scope", () => {
			const adminRes: AccessResolution = {
				status: "admin",
				userId: mockUserId,
				accessType: "admin_kppn",
				kppnScopes: [{ id: mockScopeId1, code: "089", name: "KPPN Jakarta II" }],
			};
			const ctx = assertAdminKppnScope(adminRes, mockScopeId1);
			expect(ctx.userId).toBe(mockUserId);
		});

		it("throws ForbiddenError when Admin targets unauthorized scope", () => {
			const adminRes: AccessResolution = {
				status: "admin",
				userId: mockUserId,
				accessType: "admin_kppn",
				kppnScopes: [{ id: mockScopeId1, code: "089", name: "KPPN Jakarta II" }],
			};
			expect(() => assertAdminKppnScope(adminRes, mockScopeId2)).toThrow(
				ForbiddenError,
			);
		});
	});
});
