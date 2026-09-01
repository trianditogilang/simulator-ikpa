export interface HolidayOverrideItem {
	date: string; // YYYY-MM-DD
	dayName: string;
	status: "holiday" | "joint_leave" | "special_workday";
	statusLabel: string;
	description: string;
}

export interface WorkdayCalendarVersion {
	id: string;
	version: string;
	year: number;
	ruleSetVersion: string;
	source: string;
	totalWorkingDays: number;
	totalHolidays: number;
	lastUpdated: string;
	overrides: HolidayOverrideItem[];
}

export const mockWorkdayCalendar2026: WorkdayCalendarVersion = {
	id: "cal-2026-v1",
	version: "2026.1",
	year: 2026,
	ruleSetVersion: "2026.1",
	source: "SKB 3 Menteri tentang Hari Libur Nasional dan Cuti Bersama Tahun 2026",
	totalWorkingDays: 248,
	totalHolidays: 27,
	lastUpdated: "01 Jan 2026, 08.00 WIB",
	overrides: [
		{
			date: "2026-01-01",
			dayName: "Kamis",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Tahun Baru 2026 Masehi",
		},
		{
			date: "2026-01-16",
			dayName: "Jumat",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Isra Mi'raj Nabi Muhammad SAW",
		},
		{
			date: "2026-02-17",
			dayName: "Selasa",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Tahun Baru Imlek 2577 Kongzili",
		},
		{
			date: "2026-03-20",
			dayName: "Jumat",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Hari Suci Nyepi Tahun Baru Saka 1948",
		},
		{
			date: "2026-03-21",
			dayName: "Sabtu",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Hari Raya Idul Fitri 1447 H (Hari 1)",
		},
		{
			date: "2026-03-22",
			dayName: "Minggu",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Hari Raya Idul Fitri 1447 H (Hari 2)",
		},
		{
			date: "2026-03-23",
			dayName: "Senin",
			status: "joint_leave",
			statusLabel: "Cuti Bersama",
			description: "Cuti Bersama Idul Fitri 1447 H",
		},
		{
			date: "2026-05-01",
			dayName: "Jumat",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Hari Buruh Internasional",
		},
		{
			date: "2026-05-14",
			dayName: "Kamis",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Kenaikan Yesus Kristus",
		},
		{
			date: "2026-05-27",
			dayName: "Rabu",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Hari Raya Idul Adha 1447 H",
		},
		{
			date: "2026-06-01",
			dayName: "Senin",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Hari Lahir Pancasila",
		},
		{
			date: "2026-06-16",
			dayName: "Selasa",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Tahun Baru Islam 1448 H",
		},
		{
			date: "2026-08-17",
			dayName: "Senin",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Hari Kemerdekaan Republik Indonesia Ke-81",
		},
		{
			date: "2026-08-25",
			dayName: "Selasa",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Maulid Nabi Muhammad SAW",
		},
		{
			date: "2026-12-25",
			dayName: "Jumat",
			status: "holiday",
			statusLabel: "Libur Nasional",
			description: "Hari Raya Natal",
		},
	],
};

export function getMockWorkdayCalendar(): WorkdayCalendarVersion {
	return mockWorkdayCalendar2026;
}
