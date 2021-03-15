import type { SMTPServerAddress, SMTPServerOptions } from 'smtp-server';
import { SMTPServer } from 'smtp-server';

const INSECURE_PORT = process.env['CEN5035Spring2021bruck010InsecurePort'];
const FROM_ADDRESS = process.env['CEN5035Spring2021bruck010Email'];
const SMTP_PASSWORD = process.env['CEN5035Spring2021bruck010Password'];

let smtpServer: SMTPServer;
export async function startSMTPServer(
    onEmailReceived: (rcptTo: SMTPServerAddress[], data: Buffer[]) => void) : Promise<void> {

    const smtpServerOptions: SMTPServerOptions = {
        name: 'localhost',
        onAuth(auth, _, callback) {
            if (auth.username === FROM_ADDRESS && auth.password === SMTP_PASSWORD) {
                return callback(
                    null,
                    {
                        user: FROM_ADDRESS
                    });
            }
            callback(new Error('Invalid username or password'));
        },
        onConnect(session, callback) {
            if (session.remoteAddress === '127.0.0.1') {
                return callback();
            }
            callback(new Error('Only localhost connections allowed'));
        },
        onMailFrom(address, _, callback) {
            if (address.address === FROM_ADDRESS) {
                return callback();
            }
            callback(new Error('Invalid from address'));
        },
        onData(stream, session, callback) {
            const data: Buffer[] = [];
            stream.on('data', data.push.bind(data) as (data: unknown) => void);
            stream.on('end', () => {
                onEmailReceived(session.envelope.rcptTo, data);
                callback();
            });
        }
    };

    if (INSECURE_PORT) {
        smtpServerOptions.secure = false;
        smtpServerOptions.disabledCommands = [
            'STARTTLS'
        ];
        smtpServerOptions.allowInsecureAuth = true;
        smtpServerOptions.disableReverseLookup = true;
    }

    smtpServer = new SMTPServer(smtpServerOptions);
    smtpServer.on('error', err => {
        console.error(err);
        process.exit(1);
    });

    await new Promise<void>((resolve, reject) => {
        try {
            const server = smtpServer.listen(INSECURE_PORT || 465, resolve);
            server.on('error', err => {
                console.error(err);
                process.exit(1);
            });
        } catch (e) {
            reject(e);
        }
    });
}
export async function stopSMTPServer() : Promise<void> {
    await new Promise<void>(resolve => smtpServer.close(resolve));
}
