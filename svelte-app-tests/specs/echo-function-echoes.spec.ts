import http from 'http';
import url from 'url';

describe('Echo Azure Function echoes', () => {
    it('Echo should return request values', async () => {
        const requestQuery = {
            'queryMixed[]': [
                1,
                'a'
            ],
            queryString: 'b',
            queryNumber: 2
        };
        const requestSearchParams = Object.entries(requestQuery).reduce((previousValue, currentValue) => {
            const partialSearchParams = previousValue.queryString ? `${previousValue.queryString}&` : '?';
            const currentValueKey = currentValue[0];
            const currentValueValue = currentValue[1];

            if (typeof currentValueValue === 'string' || typeof currentValueValue === 'number') {
                const expectedQuery = previousValue.expectedQuery;

                expectedQuery[currentValueKey] = currentValueValue.toString();
                return {
                    queryString: `${partialSearchParams}${currentValueKey}=${currentValueValue}`,
                    expectedQuery
                };
            }

            const requestSearchParamParts = currentValueValue.reduce((previousValue, currentValue) =>
                ({
                    queryString: (previousValue.queryString ? `${previousValue.queryString}&` : '') +
                        `${currentValueKey}=${currentValue}`,
                    expectedQuery:
                        `${(previousValue.expectedQuery ? `${previousValue.expectedQuery},` : '')}${currentValue}`
                }), {
                queryString: '',
                expectedQuery: ''
            });
            const expectedQuery = previousValue.expectedQuery;

            expectedQuery[currentValueKey] = requestSearchParamParts.expectedQuery;
            return {
                queryString: `${partialSearchParams}${requestSearchParamParts.queryString}`,
                expectedQuery
            };
        }, {
            queryString: '',
            expectedQuery: {} as { [ key: string ]: string | number }
        });
        const requestUrl = new url.URL(`http://localhost:7071/api/Echo${requestSearchParams.queryString}`);
        const requestBody = {
            bodyMixed: [
                3,
                'c'
            ],
            bodyString: 'd',
            bodyNumber: 4
        };
        const requestBodyString = JSON.stringify(requestBody);
        const response = await new Promise<string>((resolve, reject) => {
            makeRequest();

            function makeRequest() {
                const request = http.request({
                    port: requestUrl.port,
                    host: requestUrl.hostname,
                    path: requestUrl.pathname + requestUrl.search || '',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': requestBodyString.length
                    }
                }, response => {
                    let data = '';
                    let error: Error;
                    response.on('data', innerData => data += innerData);
                    response.on('end', () => !error && resolve(data));
                    response.on('error', (err) => reject(error = err));
                });

                request.on('error', (err) => {
                    if (request.reusedSocket && err.code === 'ECONNRESET') {
                        makeRequest();
                    } else {
                        reject(err);
                    }
                });

                request.write(requestBodyString);
                request.end();
            }
        });

        expect(response).toBe(JSON.stringify({
            query: requestSearchParams.expectedQuery,
            body: requestBody
        }));
    });
});
