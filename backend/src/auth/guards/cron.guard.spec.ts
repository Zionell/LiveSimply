import { UnauthorizedException } from "@nestjs/common";
import { CronGuard } from "./cron.guard";

describe("CronGuard", () => {
	const contextWith = (authorization?: string) =>
		({
			switchToHttp: () => ({
				getRequest: () => ({ headers: { authorization } }),
			}),
		}) as any;

	const guardWith = (secret?: string) =>
		new CronGuard({ get: () => secret } as any);

	it("lets the scheduler through when the secret matches", () => {
		expect(
			guardWith("s3cret").canActivate(contextWith("Bearer s3cret"))
		).toBe(true);
	});

	it("rejects a wrong secret of the same length", () => {
		expect(() =>
			guardWith("s3cret").canActivate(contextWith("Bearer s3cre7"))
		).toThrow(UnauthorizedException);
	});

	it("rejects a secret of a different length", () => {
		expect(() =>
			guardWith("s3cret").canActivate(contextWith("Bearer s3cretcret"))
		).toThrow(UnauthorizedException);
	});

	it("rejects a request without an Authorization header", () => {
		expect(() => guardWith("s3cret").canActivate(contextWith())).toThrow(
			UnauthorizedException
		);
	});

	// Без секрета маршрут был бы открыт всему интернету, поэтому закрываемся.
	it("rejects every request when CRON_SECRET is not configured", () => {
		expect(() =>
			guardWith(undefined).canActivate(contextWith("Bearer anything"))
		).toThrow(UnauthorizedException);
	});
});
