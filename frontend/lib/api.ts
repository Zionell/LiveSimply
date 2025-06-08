const prefix = "/api/v2";

export const api = {
	auth: {
		login: `${prefix}/auth/login/`,
		profile: `${prefix}/auth/profile/`,
		logout: `${prefix}/auth/logout/`,
	},
	users: {
		common: `${prefix}/users/`,
		verify: `${prefix}/users/verify/`,
	},
	finance: {
		common: `${prefix}/finance/`,
		specs: `${prefix}/finance/specs/`,
		statistics: `${prefix}/finance/statistics/`,
	},
	rates: {
		common: `${prefix}/rates/`,
		current: `${prefix}/rates/current/`,
		convert: `${prefix}/rates/convert/`,
	},
	businessCard: {
		common: `${prefix}/business-card/`,
		link: `${prefix}/business-card/link/`,
		preview: `${prefix}/business-card/preview/`,
	},
	goals: {
		common: `${prefix}/goals/`,
	},
};
