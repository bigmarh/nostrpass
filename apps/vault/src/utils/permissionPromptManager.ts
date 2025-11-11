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

      // Dispatch the permission prompt event
      try {
        window.dispatchEvent(new CustomEvent('vault-permission-prompt', {
          detail: {
            ...request,
            requestId
          }
        }));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingPrompts.delete(requestId);
        reject(new Error('Failed to dispatch permission prompt'));
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
