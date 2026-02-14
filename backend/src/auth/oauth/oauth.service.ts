import { OAuthProvider } from "~/auth/oauth/oauth.types";
import { Inject, Injectable } from "@nestjs/common";
import { OAUTH_PROVIDERS } from "~/auth/oauth/constants";

@Injectable()
export class OAuthService {
	private readonly providers = new Map<string, OAuthProvider>();

	constructor(
		@Inject(OAUTH_PROVIDERS)
		providers: OAuthProvider[]
	) {
		providers.forEach(p => this.providers.set(p.name, p));
	}

	getProvider(name: string): OAuthProvider {
		const provider = this.providers.get(name);
		if (!provider) {
			throw new Error(`OAuth provider "${name}" not supported`);
		}
		return provider;
	}
}
