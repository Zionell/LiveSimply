import { Injectable } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";
import { I18nService } from "nestjs-i18n";

interface IMailSendProps {
	to: string;
	template: string;
	locale: string;
	props?: Record<string, string>;
}

@Injectable()
export class MailService {
	constructor(
		private readonly mailerService: MailerService,
		private readonly i18nService: I18nService
	) {}

	async sendEmail({ to, template, locale, props }: IMailSendProps) {
		const subject = this.i18nService.translate(`mail.${template}`, {
			lang: locale,
		});

		await this.mailerService.sendMail({
			to,
			subject: subject,
			template: `${locale}/${template}`,
			context: props,
		});
	}
}
