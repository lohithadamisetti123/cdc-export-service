export interface User {
    id: string;
    name: string;
    email: string;
    created_at: Date;
    updated_at: Date;
    is_deleted: boolean;
}

export interface Watermark {
    id: number;
    consumer_id: string;
    last_exported_at: Date;
    updated_at: Date;
}

export type ExportType = 'full' | 'incremental' | 'delta';

export interface ExportJobResponse {
    jobId: string;
    status: 'started';
    exportType: ExportType;
    outputFilename: string;
}

export interface ExportToCsvParams {
    rows: any[];
    exportType: ExportType;
    consumerId: string;
    filename: string;
}

export interface ExportResult {
    filePath: string;
    rowsExported: number;
}
