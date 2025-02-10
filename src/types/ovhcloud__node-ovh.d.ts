declare module '@ovhcloud/node-ovh' {
    interface OvhClient {
        request(
            method: 'GET' | 'POST' | 'PUT' | 'DELETE',
            path: string,
            callback: (error: Error | null, result: any) => void
        ): void;
        request(
            method: 'GET' | 'POST' | 'PUT' | 'DELETE',
            path: string,
            data: any,
            callback: (error: Error | null, result: any) => void
        ): void;
    }

    interface OvhConfig {
        appKey: string;
        appSecret: string;
        consumerKey: string;
        endpoint: string;
    }

    function ovh(config: OvhConfig): OvhClient;
    export default ovh;
}
