import type { SMTPServerAddress } from 'smtp-server';
import { startSMTPServer } from './modules/smtpServer';
import { play } from 'node-wav-player';

startSMTPServer((_: SMTPServerAddress[], data: Buffer[]) => {
    console.log(Buffer.concat(data).toString('utf-8'));
    play(
        {
            path: '521094__optronteam__e-mail.wav'
        })
        .catch(console.error);
});
