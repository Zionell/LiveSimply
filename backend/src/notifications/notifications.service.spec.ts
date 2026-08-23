import { ForbiddenException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { ENotificationGroup, ENotificationType } from "./types";
import { ERole } from "../../types/user";

const buildPrismaMock = () => ({
	notification: {
		create: jest.fn(),
	},
	user: {
		findUnique: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
	},
});

const i18nMock = {
	translate: jest.fn((key: string) => key),
} as any;

const mailMock = {
	sendEmail: jest.fn(),
};

const req = { payload: { id: "u1", role: ERole.LVL3 } };
const adminReq = { payload: { id: "u1", role: ERole.ADMIN } };

const notification = {
	id: "n1",
	type: ENotificationType.BudgetItemThreshold,
	title: "Rent: 70% of the plan spent",
	text: "You have spent 700 of 1000 EUR.",
	isReaded: false,
	createdAt: new Date("2026-08-10T00:00:00.000Z"),
};

describe("NotificationsService", () => {
	let prisma: ReturnType<typeof buildPrismaMock>;
	let service: NotificationsService;

	beforeEach(() => {
		prisma = buildPrismaMock();
		mailMock.sendEmail.mockReset().mockResolvedValue(undefined);
		service = new NotificationsService(
			prisma as any,
			i18nMock,
			mailMock as any
		);
	});

	describe("getSettings", () => {
		it("lists only the groups something can actually notify about", async () => {
			prisma.user.findUnique.mockResolvedValue({
				emailNotifications: null,
			});

			const result = await service.getSettings(req);

			expect(result.map(s => s.group)).toEqual([
				ENotificationGroup.Finance,
				ENotificationGroup.Planner,
				ENotificationGroup.Goals,
			]);
		});

		it("keeps the rates group out of a regular user's list", async () => {
			prisma.user.findUnique.mockResolvedValue({
				emailNotifications: { rates: true },
			});

			const result = await service.getSettings(req);

			expect(result.map(s => s.group)).not.toContain(
				ENotificationGroup.Rates
			);
		});

		it("offers the rates group to an admin", async () => {
			prisma.user.findUnique.mockResolvedValue({
				emailNotifications: null,
			});

			const result = await service.getSettings(adminReq);

			expect(result.map(s => s.group)).toEqual([
				ENotificationGroup.Finance,
				ENotificationGroup.Planner,
				ENotificationGroup.Goals,
				ENotificationGroup.Rates,
			]);
		});

		it("treats a group the user never touched as email-off", async () => {
			prisma.user.findUnique.mockResolvedValue({
				emailNotifications: { finance: true },
			});

			const result = await service.getSettings(req);

			expect(result).toEqual([
				{ group: "finance", isEmailEnabled: true },
				{ group: "planner", isEmailEnabled: false },
				{ group: "goals", isEmailEnabled: false },
			]);
		});
	});

	describe("updateSettings", () => {
		it("flips one group without dropping the others", async () => {
			prisma.user.findUnique.mockResolvedValue({
				emailNotifications: { finance: true },
			});

			const result = await service.updateSettings(
				{ group: ENotificationGroup.Planner, isEmailEnabled: true },
				req
			);

			expect(prisma.user.update).toHaveBeenCalledWith({
				where: { id: "u1" },
				data: {
					emailNotifications: { finance: true, planner: true },
					updatedAt: expect.any(Date),
				},
			});
			expect(result).toEqual([
				{ group: "finance", isEmailEnabled: true },
				{ group: "planner", isEmailEnabled: true },
				{ group: "goals", isEmailEnabled: false },
			]);
		});

		it("refuses a group the user's role cannot see", async () => {
			await expect(
				service.updateSettings(
					{
						group: ENotificationGroup.Rates,
						isEmailEnabled: true,
					},
					req
				)
			).rejects.toBeInstanceOf(ForbiddenException);

			expect(prisma.user.update).not.toHaveBeenCalled();
		});

		it("can turn a group back off", async () => {
			prisma.user.findUnique.mockResolvedValue({
				emailNotifications: { finance: true, planner: true },
			});

			await service.updateSettings(
				{ group: ENotificationGroup.Finance, isEmailEnabled: false },
				req
			);

			expect(prisma.user.update).toHaveBeenCalledWith({
				where: { id: "u1" },
				data: {
					emailNotifications: { finance: false, planner: true },
					updatedAt: expect.any(Date),
				},
			});
		});
	});

	describe("emailIfEnabled", () => {
		const stored = {
			id: "n1",
			userId: "u1",
			type: ENotificationType.BudgetItemThreshold,
			params: { percent: 70 },
			isReaded: false,
			createdAt: new Date("2026-08-10T00:00:00.000Z"),
			updatedAt: new Date("2026-08-10T00:00:00.000Z"),
		} as any;

		const user = (overrides: Record<string, unknown> = {}) => ({
			email: "user@example.com",
			emailVerified: true,
			emailNotifications: { finance: true },
			language: "en",
			...overrides,
		});

		it("emails when the notification's own group is enabled", async () => {
			prisma.user.findUnique.mockResolvedValue(user());

			await service.emailIfEnabled(stored);

			expect(mailMock.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: "user@example.com",
					template: "notification",
					locale: "en",
				})
			);
		});

		it("does not email when a different group is the one enabled", async () => {
			prisma.user.findUnique.mockResolvedValue(user());

			await service.emailIfEnabled({
				...stored,
				type: ENotificationType.PlannerReminder,
			});

			expect(mailMock.sendEmail).not.toHaveBeenCalled();
		});

		it("stays in-app only when the user enabled nothing", async () => {
			prisma.user.findUnique.mockResolvedValue(
				user({ emailNotifications: null })
			);

			await service.emailIfEnabled(stored);

			expect(mailMock.sendEmail).not.toHaveBeenCalled();
		});

		it("skips an unverified address even when the group is enabled", async () => {
			prisma.user.findUnique.mockResolvedValue(
				user({ emailVerified: false })
			);

			await service.emailIfEnabled(stored);

			expect(mailMock.sendEmail).not.toHaveBeenCalled();
		});

		it("writes the email in the recipient's language, not the request's", async () => {
			prisma.user.findUnique.mockResolvedValue(user({ language: "ru" }));

			await service.emailIfEnabled(stored);

			expect(i18nMock.translate).toHaveBeenCalledWith(
				"notification.budget.item.threshold.title",
				expect.objectContaining({ lang: "ru" })
			);
			expect(mailMock.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({ locale: "ru" })
			);
		});

		it("falls back to the request language for a user who has none stored", async () => {
			prisma.user.findUnique.mockResolvedValue(user({ language: null }));

			await service.emailIfEnabled(stored);

			expect(mailMock.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({ locale: "en" })
			);
		});

		it("swallows a mail failure so the in-app notification still stands", async () => {
			prisma.user.findUnique.mockResolvedValue(user());
			mailMock.sendEmail.mockRejectedValue(new Error("smtp down"));
			const warnSpy = jest.spyOn(console, "warn").mockImplementation();

			await expect(
				service.emailIfEnabled(stored)
			).resolves.toBeUndefined();

			warnSpy.mockRestore();
		});
	});

	describe("updateRatesNotification", () => {
		const admin = (overrides: Record<string, unknown> = {}) => ({
			id: "a1",
			email: "admin@example.com",
			emailVerified: true,
			emailNotifications: { rates: true },
			language: "ru",
			...overrides,
		});

		beforeEach(() => {
			prisma.notification.create.mockResolvedValue({});
		});

		it("stores a success notification and mails the matching template", async () => {
			prisma.user.findMany.mockResolvedValue([admin()]);

			await service.updateRatesNotification();

			expect(prisma.notification.create).toHaveBeenCalledWith({
				data: {
					userId: "a1",
					type: ENotificationType.RatesUpdate,
					params: {},
				},
			});
			expect(mailMock.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					template: "updateRates",
					locale: "ru",
				})
			);
		});

		it("stores the failure under its own type so the text is not a lie", async () => {
			prisma.user.findMany.mockResolvedValue([admin()]);

			await service.updateRatesNotification({
				error: "boom",
				errorMsg: "timeout",
			});

			expect(prisma.notification.create).toHaveBeenCalledWith({
				data: {
					userId: "a1",
					type: ENotificationType.RatesUpdateError,
					params: { error: "boom", errorMsg: "timeout" },
				},
			});
			expect(mailMock.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					template: "updateRatesError",
					props: { error: "boom", errorMsg: "timeout" },
				})
			);
		});

		it("keeps the notification in-app when the admin turned the group off", async () => {
			prisma.user.findMany.mockResolvedValue([
				admin({ emailNotifications: { rates: false } }),
			]);

			await service.updateRatesNotification();

			expect(prisma.notification.create).toHaveBeenCalled();
			expect(mailMock.sendEmail).not.toHaveBeenCalled();
		});

		it("does not mail an unverified admin address", async () => {
			prisma.user.findMany.mockResolvedValue([
				admin({ emailVerified: false }),
			]);

			await service.updateRatesNotification();

			expect(mailMock.sendEmail).not.toHaveBeenCalled();
		});

		it("normalizes a regional language down to a shipped template", async () => {
			prisma.user.findMany.mockResolvedValue([admin({ language: "ru-RU" })]);

			await service.updateRatesNotification();

			expect(mailMock.sendEmail).toHaveBeenCalledWith(
				expect.objectContaining({ locale: "ru" })
			);
		});
	});

	describe("create", () => {
		it("hands the stored notification to the email path", async () => {
			const created = {
				id: "n1",
				userId: "u1",
				type: ENotificationType.BudgetItemThreshold,
				params: {},
				isReaded: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			prisma.notification.create.mockResolvedValue(created);
			const emailSpy = jest
				.spyOn(service, "emailIfEnabled")
				.mockResolvedValue(undefined);

			await service.create({
				userId: "u1",
				type: ENotificationType.BudgetItemThreshold,
				params: {
					percent: 70,
					spent: 700,
					planned: 1000,
					currency: "EUR",
				},
			});

			expect(emailSpy).toHaveBeenCalledWith(created);
		});
	});
});
