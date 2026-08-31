import { type ApiError, apiErrorSchema } from "@simulator-ikpa/contracts";
import {
	getMockScenario,
	MOCK_SCENARIOS,
	type MockScenario,
	type MockScenarioId,
} from "./scenario";

export type MockServiceResponse<T> = {
	data: T;
	scenarioId: MockScenarioId;
};

export type MockService = {
	readonly selectedScenarioId: MockScenarioId;
	listScenarios(): readonly MockScenario[];
	selectScenario(id: string): MockScenario;
	getSelectedScenario(): MockScenario;
	request<T>(data: T): Promise<MockServiceResponse<T>>;
	getScenario(): Promise<MockServiceResponse<MockScenario>>;
};

export function isMockApiError(value: unknown): value is ApiError {
	return apiErrorSchema.safeParse(value).success;
}

export function createMockService(
	initialScenarioId: string = "SCN-NORMAL",
): MockService {
	let selectedScenarioId = getMockScenario(initialScenarioId).id;

	const service: MockService = {
		get selectedScenarioId() {
			return selectedScenarioId;
		},
		listScenarios() {
			return MOCK_SCENARIOS;
		},
		selectScenario(id) {
			const scenario = getMockScenario(id);
			selectedScenarioId = scenario.id;
			return scenario;
		},
		getSelectedScenario() {
			return getMockScenario(selectedScenarioId);
		},
		async request<T>(data: T) {
			const scenario = getMockScenario(selectedScenarioId);

			if (scenario.error) {
				throw apiErrorSchema.parse(scenario.error);
			}

			return { data, scenarioId: scenario.id };
		},
		async getScenario() {
			return service.request(service.getSelectedScenario());
		},
	};

	return service;
}
