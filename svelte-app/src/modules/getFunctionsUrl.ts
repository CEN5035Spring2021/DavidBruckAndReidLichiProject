export default function getDefaultFunctionsUrl() : string {
    switch (location.hostname) {
        case 'localhost':
        case '127.0.0.1':
            return 'http://localhost:7071/';
    }
    return 'https://cen5035spring2021davidbruckproject.azurewebsites.net/';
}
