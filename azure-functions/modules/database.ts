import type { ContainerResponse, DatabaseResponse } from '@azure/cosmos';
import allowSelfSignedCertificates from './allowSelfSignedCertificates';
import createCosmosClient from './createCosmosClient';

const DATABASE = process.env['CEN5035Spring2021Database'];
export function getDatabase() : Promise<DatabaseResponse> {
    allowSelfSignedCertificates();

    const client = createCosmosClient();

    return client.databases.createIfNotExists(
        {
            id: DATABASE
        });
}

export function getOrganizationsContainer(database: DatabaseResponse) : Promise<ContainerResponse> {
    return database.database.containers.createIfNotExists({
        id: 'Organizations',
        partitionKey: '/name',
        uniqueKeyPolicy: {
            uniqueKeys: [
                {
                    paths: [
                        '/name'
                    ]
                }
            ]
        }
    });
}

export function getOrganizationConfirmationsContainer(database: DatabaseResponse) : Promise<ContainerResponse> {
    return database.database.containers.createIfNotExists({
        id: 'OrganizationConfirmations'
    });
}

export function getUsersContainer(database: DatabaseResponse) : Promise<ContainerResponse> {
    return database.database.containers.createIfNotExists({
        id: 'Users',
        partitionKey: '/lowercasedEmailAddress',
        uniqueKeyPolicy: {
            uniqueKeys: [
                {
                    paths: [
                        '/lowercasedEmailAddress'
                    ]
                }
            ]
        }
    });
}

export function getOrganizationUsersContainer(database: DatabaseResponse) : Promise<ContainerResponse> {
    return database.database.containers.createIfNotExists({
        id: 'OrganizationUsers',
        partitionKey: '/organizationId',
        uniqueKeyPolicy: {
            uniqueKeys: [
                {
                    paths: [
                        '/organizationId',
                        '/userId'
                    ]
                }
            ]
        }
    });
}
