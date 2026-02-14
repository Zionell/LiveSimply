type navItem = {
	key: string;
	to: ERoutes;
};

export const navigation: navItem[] = [
	{ to: ERoutes.dashboard, key: "dashboard" },
	{ to: ERoutes.financeList, key: "finance-list" },
	{ to: ERoutes.financePlanner, key: "finance-planner" },
	{ to: ERoutes.goals, key: "goals" },
	{ to: ERoutes.businessCard, key: "business-card" },
];
