import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuthProfile, OAuthProvider } from "~/auth/oauth/oauth.types";

@Injectable()
export class GoogleOAuthProvider implements OAuthProvider {
	name: OAuthProfile["provider"] = "google";

	constructor(private configService: ConfigService) {}

	private readonly clientId = this.configService.get("GOOGLE_CLIENT_ID");
	private readonly clientSecret = this.configService.get(
		"GOOGLE_CLIENT_SECRET"
	);
	private readonly redirectUri = this.configService.get(
		"GOOGLE_REDIRECT_URI"
	);

	getAuthUrl(state: string): string {
		const params = new URLSearchParams({
			client_id: this.clientId,
			redirect_uri: this.redirectUri,
			response_type: "code",
			scope: "openid email profile",
			state,
			prompt: "consent",
		});

		return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
	}

	async getToken(code: string) {
		const res = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code,
				client_id: this.clientId,
				client_secret: this.clientSecret,
				redirect_uri: this.redirectUri,
				grant_type: "authorization_code",
			}),
		});

		const data = await res.json();

		return { accessToken: data.access_token };
	}

	async getProfile(accessToken: string): Promise<OAuthProfile> {
		const res = await fetch(
			"https://www.googleapis.com/oauth2/v3/userinfo",
			{
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const profile = await res.json();

		return {
			provider: "google",
			providerId: profile.sub,
			email: profile.email,
			name: profile.name,
			avatar: profile.picture,
		};
	}
}
