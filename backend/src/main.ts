import { NestFactory } from "@nestjs/core";
import * as cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { I18nValidationExceptionFilter } from "nestjs-i18n";
import { ValidationPipe } from "@nestjs/common";
import * as process from "node:process";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	// Middleware
	app.enableCors({
		origin: process.env.SITE_URL || `http://localhost:3000`,
		allowedHeaders: ["Authorization", "Content-Type", "x-csrf-token"],
		credentials: true,
		preflightContinue: true,
	});
	app.use(cookieParser(process.env.COOKIES_SECRET));

	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
		})
	);
	app.setGlobalPrefix("api/v2/");
	app.useGlobalFilters(
		new I18nValidationExceptionFilter({
			detailedErrors: false,
		})
	);
	// Middleware end

	// Swagger
	const config = new DocumentBuilder()
		.setTitle("LiveSimply")
		.setDescription("The API description")
		.setVersion("1.0")
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup("api/v2/docs", app, document);
	// Swagger end

	await app.listen(process.env.PORT || 8000);
}

bootstrap();
