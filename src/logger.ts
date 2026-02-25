export const info = (message: string, context: Record<string, any> = {}) => {
    console.log(
        JSON.stringify({
            level: 'info',
            message,
            timestamp: new Date().toISOString(),
            ...context,
        }),
    );
};

export const error = (message: string, context: Record<string, any> = {}) => {
    console.error(
        JSON.stringify({
            level: 'error',
            message,
            timestamp: new Date().toISOString(),
            ...context,
        }),
    );
};
