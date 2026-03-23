import { createSignal, createMemo, For, onMount } from 'solid-js';

interface PinPadProps {
  onComplete: (pin: string) => void;
  onShakeRequest?: (shaker: () => void) => void;
  onClearRequest?: (clearer: () => void) => void;
}

const BACKSPACE_SVG = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
    />
  </svg>
);

export function PinPad(props: PinPadProps) {
  const [pin, setPin] = createSignal('');
  const [shaking, setShaking] = createSignal(false);
  // Scramble digits once on mount
  const [digits] = createSignal(
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].sort(() => Math.random() - 0.5)
  );

  const dots = createMemo(() => {
    const filled = pin().length;
    return Array.from({ length: 6 }, (_, i) => i < filled);
  });

  const addDigit = (d: string) => {
    if (pin().length >= 6) return;
    const next = pin() + d;
    setPin(next);
    if (next.length === 6) {
      setTimeout(() => props.onComplete(next), 400);
    }
  };

  const removeDigit = () => {
    setPin((p) => p.slice(0, -1));
  };

  const clear = () => {
    setPin('');
  };

  const shake = () => {
    setShaking(true);
    setTimeout(() => {
      setShaking(false);
      clear();
    }, 500);
  };

  onMount(() => {
    props.onShakeRequest?.(shake);
    props.onClearRequest?.(clear);
  });

  return (
    <div class="flex flex-col items-center gap-4 w-full">
      {/* PIN dots pill */}
      <div
        class="inline-flex items-center gap-2.5 bg-gray-700 px-5 py-2.5 rounded-full"
        classList={{ 'shake-animation': shaking() }}
      >
        <For each={dots()}>
          {(filled) => (
            <div
              class="w-2.5 h-2.5 rounded-full transition-transform"
              classList={{
                'bg-white scale-125': filled,
                'bg-gray-500': !filled,
              }}
            />
          )}
        </For>
      </div>

      {/* PIN grid */}
      <div class="grid grid-cols-3 gap-2 w-full max-w-[240px]">
        <For each={digits()}>
          {(num) => (
            <button
              type="button"
              class="aspect-square bg-white border-[1.5px] border-gray-200 rounded-xl text-lg font-semibold shadow-sm hover:bg-gray-50 active:scale-90 transition-all flex items-center justify-center text-gray-900"
              onClick={() => addDigit(num)}
            >
              {num}
            </button>
          )}
        </For>
        {/* Backspace spans 2 cols */}
        <button
          type="button"
          class="col-span-2 bg-white border-[1.5px] border-gray-200 rounded-xl text-sm font-medium shadow-sm hover:bg-gray-50 active:scale-90 transition-all flex items-center justify-center gap-1.5 py-2.5 text-gray-700"
          onClick={removeDigit}
        >
          {BACKSPACE_SVG} Delete
        </button>
        {/* Empty spacer to keep 3-col grid */}
        <div />
      </div>
    </div>
  );
}
