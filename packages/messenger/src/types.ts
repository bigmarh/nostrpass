export interface MessagePayload {
    id: string;
    type: string;
    data: any;
    timestamp: number;
    origin: string;
  }
  
  export interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }
  
  // Middleware types
  export interface MiddlewareContext {
    type: string;
    data: any;
    origin: string;
    timestamp: number;
    metadata: Record<string, any>; // For storing middleware state
  }
  
  export type MiddlewareHandler = (
    context: MiddlewareContext,
    next: () => Promise<any>
  ) => Promise<any>;
  
  export interface RouteConfig {
    handler: (data: any, context: MiddlewareContext) => Promise<any> | any;
    middleware?: MiddlewareHandler[];
  }
