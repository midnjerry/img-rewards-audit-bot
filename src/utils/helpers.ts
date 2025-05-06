export function sleep(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function formatTimestamp(timestamp:number):string {
    if (!timestamp){
        return 'No Date';
    }
    return new Date(timestamp).toLocaleString();
}