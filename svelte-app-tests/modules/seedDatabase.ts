import allowSelfSignedCertificates from '../../azure-functions/modules/allowSelfSignedCertificates';
import createCosmosClient from '../../azure-functions/modules/createCosmosClient';
import type { CosmosClient, DatabaseDefinition, Resource } from '@azure/cosmos';

const DATABASE_ID_PARAM = '@id';
const DATABASE_ID = 'CEN5035Spring2021DavidBruckTests';

export default seedDatabase;
async function seedDatabase() : Promise<void> {
    allowSelfSignedCertificates();

    const client = createCosmosClient();

    await deleteExistingDatabase(client);

    await client.databases.create({
        id: DATABASE_ID
    });
}

async function deleteExistingDatabase(client: CosmosClient) : Promise<void> {
    const databasesReader = client.databases.query({
        query: `
        SELECT c.id
        FROM c
        WHERE c.id = ${DATABASE_ID_PARAM}`,
        parameters: [
            {
                name: DATABASE_ID_PARAM,
                value: DATABASE_ID
            }
        ]
    });
    const databases: Array<DatabaseDefinition & Resource> = [];
    do {
        databases.push(...(await databasesReader.fetchNext()).resources);
    } while (databasesReader.hasMoreResults());
    for (const database of databases) {
        await client.database(database.id).delete();
    }
}
