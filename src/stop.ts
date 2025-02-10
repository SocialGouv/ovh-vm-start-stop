import ovh from '@ovhcloud/node-ovh';
import 'dotenv/config';

async function main() {
    // Validate required environment variables
    const requiredEnvVars = [
        'OVH_ENDPOINT',
        'OVH_APPLICATION_KEY',
        'OVH_APPLICATION_SECRET',
        'OVH_CONSUMER_KEY',
        'OVH_SERVICE_NAME',
        'INSTANCE_NAME'
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`Missing required environment variable: ${envVar}`);
        }
    }

    // Initialize OVH API client
    const client = ovh({
        appKey: process.env.OVH_APPLICATION_KEY!,
        appSecret: process.env.OVH_APPLICATION_SECRET!,
        consumerKey: process.env.OVH_CONSUMER_KEY!,
        endpoint: process.env.OVH_ENDPOINT!
    });

    try {
        // First, test API connectivity
        console.log('Testing API connectivity...');
        await new Promise((resolve, reject) => {
            client.request('GET', '/auth/time', (error, result) => {
                if (error) {
                    console.error('API connectivity test failed:', error);
                    reject(error);
                } else {
                    console.log('API connectivity test successful. Server time:', result);
                    resolve(result);
                }
            });
        });

        // Test consumer key permissions
        console.log('Testing consumer key permissions...');
        await new Promise((resolve, reject) => {
            client.request('GET', '/me', (error, result) => {
                if (error) {
                    console.error('Consumer key test failed:', error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        interface Instance {
            id: string;
            name: string;
            status: string;
        }

        // List available instances
        console.log('Listing available instances...');
        const instances: Instance[] = await new Promise((resolve, reject) => {
            client.request('GET', `/cloud/project/${process.env.OVH_SERVICE_NAME!}/instance`, (error, result) => {
                if (error) {
                    console.error('Error getting instances:', error);
                    reject(error);
                } else resolve(result);
            });
        });

        // Find the instance by name
        const instance = instances.find(i => i.name === process.env.INSTANCE_NAME);
        if (!instance) {
            console.log(`Instance ${process.env.INSTANCE_NAME} not found.`);
            return;
        }

        // Delete the instance
        console.log(`Deleting instance ${instance.name} (${instance.id})...`);
        await new Promise<void>((resolve, reject) => {
            client.request('DELETE', `/cloud/project/${process.env.OVH_SERVICE_NAME!}/instance/${instance.id}`, (error) => {
                if (error) {
                    console.error('Error deleting instance:', error);
                    reject(error);
                } else {
                    console.log(`Successfully deleted instance ${instance.name}`);
                    resolve();
                }
            });
        });

    } catch (error: any) {
        console.error('Error:', error);
        if (typeof error === 'object') {
            console.error('Error properties:', Object.keys(error));
            for (const key of Object.keys(error)) {
                console.error(`${key}:`, error[key]);
            }
        }
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
