type navItem = {
	key: string;
	to: ERoutes;
	icon: string;
};

export const navigation: navItem[] = [
	{ to: ERoutes.dashboard, key: "dashboard", icon: "i-lucide-layout-dashboard" },
	{ to: ERoutes.financeList, key: "finance-list", icon: "i-lucide-arrow-left-right" },
	{ to: ERoutes.financePlanner, key: "finance-planner", icon: "i-lucide-clipboard-list" },
	{ to: ERoutes.goals, key: "goals", icon: "i-lucide-target" },
	{ to: ERoutes.businessCard, key: "business-card", icon: "i-lucide-contact" },
	{ to: ERoutes.settings, key: "settings", icon: "i-lucide-settings" },
];
