import { Module } from "@nestjs/common";
import { GoogleOAuthProvider } from "~/auth/oauth/providers/google.provider";
import { OAUTH_PROVIDERS } from "~/auth/oauth/constants";
import { OAuthService } from "~/auth/oauth/oauth.service";
import { ConfigModule } from "@nestjs/config";

@Module({
	imports: [ConfigModule],
	providers: [
		GoogleOAuthProvider,

		{
			provide: OAUTH_PROVIDERS,
			useFactory: (google: GoogleOAuthProvider) => [google],
			inject: [GoogleOAuthProvider],
		},

		OAuthService,
	],
	exports: [OAuthService],
})
export class OAuthModule {}
