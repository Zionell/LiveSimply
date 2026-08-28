export const prefix = "/api/v2";

export const api = {
	auth: {
		login: `${prefix}/auth/login/`,
		provider: (provider: string) => `${prefix}/auth/${provider}/`,
		profile: `${prefix}/auth/profile/`,
		logout: `${prefix}/auth/logout/`,
	},
	users: {
		common: `${prefix}/users/`,
	},
	finance: {
		common: `${prefix}/finance/`,
		specs: `${prefix}/finance/specs/`,
		statistics: `${prefix}/finance/statistics/`,
		expenseCategories: `${prefix}/finance/expense-categories/`,
		reset: `${prefix}/finance/reset/`,
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
	planner: {
		common: `${prefix}/planner/`,
		detail: (id: string) => `${prefix}/planner/${id}/`,
		items: (id: string) => `${prefix}/planner/${id}/items/`,
		item: (itemId: string) => `${prefix}/planner/items/${itemId}/`,
	},
	health: {
		profile: `${prefix}/health/profile/`,
		body: `${prefix}/health/body/`,
		bodyDetail: (id: string) => `${prefix}/health/body/${id}/`,
		products: `${prefix}/health/products/`,
		nutrition: `${prefix}/health/nutrition/`,
		nutritionDetail: (id: string) => `${prefix}/health/nutrition/${id}/`,
		meals: `${prefix}/health/nutrition/meals/`,
		meal: (id: string) => `${prefix}/health/nutrition/meals/${id}/`,
		applyTargets: `${prefix}/health/nutrition/apply-targets/`,
	},
	notifications: {
		common: `${prefix}/notifications/`,
		read: (id: string) => `${prefix}/notifications/${id}/read/`,
		readAll: `${prefix}/notifications/read-all/`,
		settings: `${prefix}/notifications/settings/`,
	},
};
