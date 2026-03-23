import { createSignal } from 'solid-js';

interface PermissionScreenProps {
  origin: string;
  operation: string;
  onAllow: (remember: boolean) => void;
  onDeny: () => void;
}

export function PermissionScreen(props: PermissionScreenProps) {
  const [remember, setRemember] = createSignal(true);

  return (
    <div class="flex flex-col">
      {/* Hero */}
      <div class="flex flex-col items-center text-center px-8 pt-8 pb-6">
        <div class="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mb-5">
          <img src="/logo.svg" class="w-9 h-9" alt="NostrPass" />
        </div>
        <h2 class="text-xl font-bold text-gray-900">Permission Request</h2>
        <p class="text-sm text-gray-500 mt-1">{props.origin}</p>
      </div>

      {/* Body */}
      <div class="px-8 pb-6 flex flex-col gap-4">
        <div class="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
          <p class="text-xs text-gray-500">Requesting access to:</p>
          <p class="text-base font-semibold text-gray-900">{props.operation}</p>
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={remember()}
            onChange={(e) => setRemember(e.currentTarget.checked)}
            class="w-4 h-4 rounded"
          />
          Remember for this site
        </label>

        <div class="flex gap-2 mt-1">
          <button
            type="button"
            class="flex-1 py-2.5 px-4 bg-transparent border border-gray-200 hover:bg-gray-50 text-gray-500 font-medium text-sm rounded-xl transition-colors"
            onClick={props.onDeny}
          >
            Deny
          </button>
          <button
            type="button"
            class="flex-1 py-3 px-4 bg-gray-900 hover:bg-gray-800 active:scale-[0.98] text-white font-semibold text-sm rounded-xl transition-all"
            onClick={() => props.onAllow(remember())}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
