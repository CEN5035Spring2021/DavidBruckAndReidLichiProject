import { CosmosClient } from '@azure/cosmos';

export default function createCosmosClient(): CosmosClient {

    const cosmosDBURI = process.env['CEN5035Spring2021DavidBruckProjectCosmosDBURI'];
    const cosmosDBKey = process.env['CEN5035Spring2021DavidBruckProjectCosmosDBKey'];
    return new CosmosClient({
        endpoint: typeof cosmosDBURI === 'undefined' ? '' : cosmosDBURI,
        key: typeof cosmosDBKey === 'undefined' ? '' : cosmosDBKey
    });
}
