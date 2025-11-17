/**
 * Permission Prompt Manager
 *
 * Handles async permission prompting with proper waiting for user response
 */

interface PermissionPromptRequest {
  appOrigin: string;
  appName?: string;
  action: 'signEvent' | 'signData' | 'getPublicKey' | 'nip04' | 'getRelays';
  eventKind?: number;
  identityIndex: number;
  event?: any;
  data?: string;
  pubkey?: string;
  plaintext?: string;
  ciphertext?: string;
}

interface PermissionPromptResult {
  granted: boolean;
  level?: string;
}

class PermissionPromptManager {
  private pendingPrompts = new Map<string, {
    resolve: (result: PermissionPromptResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor() {
    // Listen for permission-granted and permission-denied events from embassy
    window.addEventListener('permission-granted', ((e: CustomEvent) => {
      const { requestId, level } = e.detail;
      if (requestId) {
        this.resolvePermission(requestId, { granted: true, level });
      }
    }) as EventListener);

    window.addEventListener('permission-denied', ((e: CustomEvent) => {
      const { requestId } = e.detail;
      if (requestId) {
        this.rejectPermission(requestId, 'Permission denied by user');
      }
    }) as EventListener);
  }

  /**
   * Request permission from user with async wait
   * Returns promise that resolves when user responds or times out
   */
  async requestPermission(request: PermissionPromptRequest): Promise<PermissionPromptResult> {
    const requestId = this.generateRequestId(request);

    // Check if there's already a pending prompt for this request
    if (this.pendingPrompts.has(requestId)) {
      throw new Error('Permission request already pending');
    }

    return new Promise<PermissionPromptResult>((resolve, reject) => {
      // Set timeout for user response (60 seconds)
      const timeout = setTimeout(() => {
        this.pendingPrompts.delete(requestId);
        reject(new Error('Permission request timed out'));
      }, 60000);

      // Store the promise handlers
      this.pendingPrompts.set(requestId, { resolve, reject, timeout });

      // Navigate to permission request page
      try {
        const currentPath = window.location.pathname;
        const appMatch = currentPath.match(/^\/([^\/]+)/);
        const app = appMatch ? appMatch[1] : 'vault';

        // Build query params
        const queryParams = new URLSearchParams({
          appOrigin: request.appOrigin,
          action: request.action,
          requestId
        });

        if (request.appName) queryParams.set('appName', request.appName);
        if (request.eventKind !== undefined) queryParams.set('eventKind', request.eventKind.toString());
        if (request.identityIndex !== undefined) queryParams.set('identityIndex', request.identityIndex.toString());
        if (request.event) queryParams.set('event', JSON.stringify(request.event));
        if (request.data) queryParams.set('data', request.data);
        if (request.pubkey) queryParams.set('pubkey', request.pubkey);
        if (request.plaintext) queryParams.set('plaintext', request.plaintext);
        if (request.ciphertext) queryParams.set('ciphertext', request.ciphertext);

        // Navigate using message (preserves Shared Worker connection)
        const messenger = (window as any).__messenger;
        if (messenger) {
          messenger.send('NAVIGATE', {
            path: `/${app}/permission-request?${queryParams.toString()}`
          });
        } else {
          // Fallback to direct navigation
          window.history.pushState({}, '', `/${app}/permission-request?${queryParams.toString()}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } catch (error) {
        clearTimeout(timeout);
        this.pendingPrompts.delete(requestId);
        reject(new Error('Failed to navigate to permission prompt'));
      }
    });
  }

  /**
   * Resolve a permission request (called when user responds)
   */
  resolvePermission(requestId: string, result: PermissionPromptResult): void {
    const pending = this.pendingPrompts.get(requestId);
    if (!pending) {
      console.warn('No pending permission request found for ID:', requestId);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingPrompts.delete(requestId);
    pending.resolve(result);
  }

  /**
   * Reject a permission request (called when user denies or cancels)
   */
  rejectPermission(requestId: string, error?: string): void {
    const pending = this.pendingPrompts.get(requestId);
    if (!pending) {
      console.warn('No pending permission request found for ID:', requestId);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingPrompts.delete(requestId);
    pending.reject(new Error(error || 'Permission denied by user'));
  }

  /**
   * Generate a unique request ID based on request parameters
   */
  private generateRequestId(request: PermissionPromptRequest): string {
    const parts = [
      request.appOrigin,
      request.action,
      request.identityIndex.toString(),
      request.eventKind?.toString() || '',
      Date.now().toString()
    ];
    return parts.join(':');
  }

  /**
   * Cancel all pending prompts (useful for cleanup)
   */
  cancelAllPending(): void {
    for (const [requestId, pending] of this.pendingPrompts.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Permission request cancelled'));
    }
    this.pendingPrompts.clear();
  }
}

// Global singleton instance
export const permissionPromptManager = new PermissionPromptManager();

// Export types
export type { PermissionPromptRequest, PermissionPromptResult };
