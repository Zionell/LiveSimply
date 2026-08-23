import { defineStore } from "pinia";
import { api } from "~~/lib/api";

export interface INotificationsStore {
	list: INotification[];
	unreadCount: number;
}

export const useNotificationsStore = defineStore("notifications", () => {
	const state = reactive<INotificationsStore>({
		list: [],
		unreadCount: 0,
	});

	async function fetchNotifications() {
		try {
			const data = await $fetch<{ result: INotification[]; unreadCount: number }>(api.notifications.common);

			state.list = data.result;
			state.unreadCount = data.unreadCount;
		} catch (e) {
			console.warn("fetchNotifications: ", e);
		}
	}

	function push(items: INotification[]) {
		if (!items?.length) {
			return;
		}

		const newItems = items.filter((item) => !state.list.some((existing) => existing.id === item.id));

		if (!newItems.length) {
			return;
		}

		state.list = [...newItems, ...state.list];
		state.unreadCount += newItems.filter((item) => !item.isReaded).length;
	}

	async function markRead(id: string) {
		try {
			await $fetch(api.notifications.read(id), { method: "PATCH" });

			const target = state.list.find((n) => n.id === id);

			if (target && !target.isReaded) {
				target.isReaded = true;
				state.unreadCount = Math.max(0, state.unreadCount - 1);
			}
		} catch (e) {
			console.warn("markRead: ", e);
		}
	}

	async function markAllRead() {
		try {
			await $fetch(api.notifications.readAll, { method: "PATCH" });

			state.list = state.list.map((n) => ({ ...n, isReaded: true }));
			state.unreadCount = 0;
		} catch (e) {
			console.warn("markAllRead: ", e);
		}
	}

	return {
		...toRefs(state),
		fetchNotifications,
		push,
		markRead,
		markAllRead,
	};
});
