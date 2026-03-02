import { Module } from '@nestjs/common';
// import { MailerModule } from '@nestjs-modules/mailer';
// import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

@Module({
  imports: [
    // MailerModule.forRootAsync({
    //   useFactory: (configService: ConfigService) => ({
    //     transport: {
    //       host: configService.get('EMAIL_HOST'),
    //       port: configService.get('EMAIL_PORT'),
    //       secure: false,
    //       auth: {
    //         user: configService.get('EMAIL_USER'),
    //         pass: configService.get('EMAIL_PASSWORD'),
    //       },
    //     },
    //     defaults: {
    //       from: configService.get('EMAIL_FROM'),
    //     },
    //     template: {
    //       dir: process.cwd() + '/templates',
    //       adapter: new HandlebarsAdapter(),
    //       options: {
    //         strict: true,
    //       },
    //     },
    //   }),
    //   inject: [ConfigService],
    // }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
