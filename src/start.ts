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
        'OVH_SSH_KEY_ID',
        'OVH_INSTANCE_FLAVOR_NAME',
        'OVH_INSTANCE_IMAGE_NAME',
        'OVH_REGION',
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
                    console.log('Consumer key test successful. Account info:', result);
                    resolve(result);
                }
            });
        });

        interface Flavor {
            id: string;
            name: string;
        }

        interface Image {
            id: string;
            name: string;
        }

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
        
        console.log('Available projects:', projects);
        
        if (!projects.includes(process.env.OVH_SERVICE_NAME!)) {
            throw new Error(`Project ${process.env.OVH_SERVICE_NAME} not found in available projects: ${projects.join(', ')}`);
        }

        // Get available regions
        console.log('Requesting regions...');
        const regions: string[] = await new Promise((resolve, reject) => {
            client.request('GET', `/cloud/project/${process.env.OVH_SERVICE_NAME!}/region`, (error, result) => {
                if (error) {
                    console.error('Error getting regions:', error);
                    reject(error);
                } else resolve(result);
            });
        });
        console.log('Available regions:', regions);
        
        if (!regions.includes(process.env.OVH_REGION!)) {
            throw new Error(`Region ${process.env.OVH_REGION} not found. Available regions: ${regions.join(', ')}`);
        }

        // Get SSH keys
        console.log('Requesting SSH keys...');
        const sshKeys: Array<{ id: string; name: string }> = await new Promise((resolve, reject) => {
            client.request('GET', `/cloud/project/${process.env.OVH_SERVICE_NAME!}/sshkey`, (error, result) => {
                if (error) {
                    console.error('Error getting SSH keys:', error);
                    reject(error);
                } else resolve(result);
            });
        });
        console.log('Available SSH keys:', sshKeys.map(key => `${key.name} (${key.id})`));

        const sshKey = sshKeys.find(key => 
            key.id.toLowerCase() === process.env.OVH_SSH_KEY_ID!.toLowerCase() ||
            key.name.toLowerCase() === process.env.OVH_SSH_KEY_ID!.toLowerCase()
        );
        if (!sshKey) {
            throw new Error(`SSH key ${process.env.OVH_SSH_KEY_ID} not found. Available keys: ${sshKeys.map(key => `${key.name} (${key.id})`).join(', ')}`);
        }

        // Get flavor ID for b3-64
        console.log('Getting flavor ID...');
        const flavors = await new Promise<any[]>((resolve, reject) => {
            client.request('GET', `/cloud/project/${process.env.OVH_SERVICE_NAME!}/flavor?region=${process.env.OVH_REGION}`, (error, result) => {
                if (error) {
                    console.error('Error getting flavors:', error);
                    reject(error);
                } else resolve(result);
            });
        });

        const flavor = flavors.find(f => f.name === 'b3-64');
        if (!flavor) {
            throw new Error('Flavor b3-64 not found');
        }

        // Get image ID for Ubuntu 24.10
        console.log('Getting image ID...');
        const images = await new Promise<any[]>((resolve, reject) => {
            client.request('GET', `/cloud/project/${process.env.OVH_SERVICE_NAME!}/image?flavorType=${flavor.id}&osType=linux&region=${process.env.OVH_REGION}`, (error, result) => {
                if (error) {
                    console.error('Error getting images:', error);
                    reject(error);
                } else resolve(result);
            });
        });

        const image = images.find(i => i.name === 'Ubuntu 24.10');
        if (!image) {
            throw new Error('Image Ubuntu 24.10 not found');
        }

        // Create the instance with the flavor and image IDs
        console.log('Creating instance with configuration:', {
            flavorId: flavor.id,
            imageId: image.id,
            name: process.env.INSTANCE_NAME,
            region: 'GRA11',
            sshKeyId: sshKey.id,
        });

        const instance = await new Promise<Instance>((resolve, reject) => {
            client.request('POST', `/cloud/project/${process.env.OVH_SERVICE_NAME!}/instance`, {
                flavorId: flavor.id,
                imageId: image.id,
                name: process.env.INSTANCE_NAME,
                region: 'GRA11',
                sshKeyId: sshKey.id,
            }, (error, result) => {
                if (error) {
                    console.error('Error creating instance:', error);
                    reject(error);
                } else resolve(result);
            });
        });

        console.log('Instance creation started:', {
            id: instance.id,
            name: instance.name,
            status: instance.status,
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
