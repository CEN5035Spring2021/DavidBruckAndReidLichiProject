import * as http from 'http';
import { receiveEmail } from './smtpHandlers';

const PORT = 5052;
let server: http.Server;
export async function startSMTPCoordinator() : Promise<void> {
    server = await new Promise<http.Server>((resolve, reject) => {
        const tempServer: http.Server = http
            .createServer((req, res) => {
                const data: Buffer[] = [];
                req.on('error', err => {
                    console.error(err);

                    res.writeHead(
                        500,
                        {
                            'Content-Type': 'text/plain',
                            'Transfer-Encoding': 'chunked'
                        });
                    res.write('Error in SMTP coordinator');
                    res.end();
                });
                req.on('data', data.push.bind(data) as (chunk: unknown) => void);
                req.on('end', () => receiveEmail(Buffer.concat(data).toString('utf-8'), email => {
                    res.writeHead(
                        200,
                        {
                            'Content-Type': 'application/binary',
                            'Transfer-Encoding': 'chunked'
                        });
                    res.write(email);
                    res.end();
                }));
            })
            .listen(PORT, undefined, undefined, () => resolve(tempServer))
            .on('error', reject);
    });
}
export function stopSMTPCoordinator() : Promise<void> {
    return new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
}
export function waitForEmail(emailAddress: string) : Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const req = http.request(
            {
                hostname: 'localhost',
                port: PORT,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                    'Transfer-Encoding': 'chunked'
                },
            },
            res => {
                const data: Buffer[] = [];
                res.on('error', reject);
                res.on('data', data.push.bind(data) as (chunk: unknown) => void);
                res.on('end', () => res.statusCode === 200
                    ? resolve(Buffer.concat(data))
                    : reject(new Error(Buffer.concat(data).toString('utf-8'))));
            });

        req.on('error', reject);
        req.write(emailAddress, 'utf-8');
        req.end();
    });
}
