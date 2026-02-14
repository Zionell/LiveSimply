export interface OAuthProfile {
	provider: "google" | "github" | "discord";
	providerId: string;
	email?: string;
	name?: string;
	avatar?: string;
}

export interface OAuthProvider {
	name: OAuthProfile["provider"];

	getAuthUrl(state: string): string;

	getToken(code: string): Promise<{
		accessToken: string;
	}>;

	getProfile(accessToken: string): Promise<OAuthProfile>;
}
