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
        'OVH_INSTANCE_NAME'
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

        // List available projects
        console.log('Listing available projects...');
        const projects: string[] = await new Promise((resolve, reject) => {
            client.request('GET', '/cloud/project', (error, result) => {
                if (error) {
                    console.error('Raw error object:', error);
                    reject(error);
                } else resolve(result);
            });
        });

        if (!projects.includes(process.env.OVH_SERVICE_NAME!)) {
            throw new Error(`Project ${process.env.OVH_SERVICE_NAME} not found in available projects: ${projects.join(', ')}`);
        }

        // Get list of instances
        console.log('Getting instances...');
        const instances = await new Promise<Instance[]>((resolve, reject) => {
            client.request('GET', `/cloud/project/${process.env.OVH_SERVICE_NAME!}/instance`, (error, result) => {
                if (error) {
                    console.error('Error getting instances:', error);
                    reject(error);
                } else resolve(result);
            });
        });

        const instance = instances.find(i => i.name === process.env.OVH_INSTANCE_NAME);
        if (!instance) {
            throw new Error(`Instance ${process.env.OVH_INSTANCE_NAME} not found. Please create it first.`);
        }

        console.log('Found instance:', {
            id: instance.id,
            name: instance.name,
            status: instance.status,
        });

        if (instance.status === 'ACTIVE') {
            console.log('Instance is already running. Nothing to do.');
            return;
        }

        if (instance.status === 'STOPPED') {
            console.log('Starting instance...');
            await new Promise<void>((resolve, reject) => {
                client.request('POST', `/cloud/project/${process.env.OVH_SERVICE_NAME!}/instance/${instance.id}/start`, {}, (error) => {
                    if (error) {
                        console.error('Error starting instance:', error);
                        reject(error);
                    } else {
                        console.log('Instance start initiated successfully');
                        resolve();
                    }
                });
            });
        } else {
            throw new Error(`Instance is in unexpected state: ${instance.status}`);
        }

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
