import * as nodemailer from 'nodemailer';
import Mail = require('nodemailer/lib/mailer');

const INSECURE_PORT = process.env['CEN5035Spring2021bruck010InsecurePort'];
const FROM_ADDRESS = process.env['CEN5035Spring2021bruck010Email'];
const SMTP_PASSWORD = process.env['CEN5035Spring2021bruck010Password'];
const SMTP_SERVER = process.env['CEN5035Spring2021bruck010SmtpServer'];
export default async function sendMail(mailOptions: Mail.Options) : Promise<void> {
    await nodemailer
        .createTransport(
            INSECURE_PORT
                ? {
                    host: typeof SMTP_SERVER === 'undefined' ? '' : SMTP_SERVER,
                    port: Number(INSECURE_PORT),
                    secure: false,
                    ignoreTLS: true,
                    auth: {
                        user: typeof FROM_ADDRESS === 'undefined' ? '' : FROM_ADDRESS,
                        pass: typeof SMTP_PASSWORD === 'undefined' ? '' : SMTP_PASSWORD
                    }
                }
                : `smtps://${encodeURIComponent(typeof FROM_ADDRESS === 'undefined' ? '' : FROM_ADDRESS)}` +
                `:${encodeURIComponent(typeof SMTP_PASSWORD === 'undefined' ? '' : SMTP_PASSWORD)}` +
                `@${typeof SMTP_SERVER === 'undefined' ? '' : SMTP_SERVER}?secure=false`)
        .sendMail(mailOptions);
}
