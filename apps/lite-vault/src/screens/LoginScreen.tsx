import { Show } from 'solid-js';
import { GoogleIcon } from '../components/GoogleIcon';
import { Spinner } from '../components/Spinner';

interface LoginScreenProps {
  onLogin: (identifier: string, authSecret: string) => void;
  onGoogleLogin: () => void;
  onClearGoogle: () => void;
  onSwitchToSignup: () => void;
  googleState: string | null;
  formError: string;
  isBusy: boolean;
  appOriginLabel: string;
  googleAvailable: boolean;
}

export function LoginScreen(props: LoginScreenProps) {
  let identifierRef!: HTMLInputElement;
  let secretRef!: HTMLInputElement;

  const handleSubmit = () => {
    props.onLogin(identifierRef.value.trim(), secretRef.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div class="flex flex-col">
      {/* Hero */}
      <div class="flex flex-col items-center text-center px-8 pt-8 pb-6">
        <div class="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center mb-5">
          <img src="/logo.svg" class="w-9 h-9" alt="NostrPass" />
        </div>
        <h1 class="text-xl font-bold text-gray-900">Sign in to your account</h1>
        <p class="text-sm text-gray-500 mt-1">
          {props.appOriginLabel ? `Sign in for ${props.appOriginLabel}` : 'Welcome back! Please sign in to continue'}
        </p>
      </div>

      {/* Error banner */}
      <Show when={props.formError}>
        <div class="mx-6 mb-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {props.formError}
        </div>
      </Show>

      {/* Body */}
      <div class="px-8 pb-6 flex flex-col gap-4">
        {/* Google button */}
        <Show
          when={props.googleState}
          fallback={
            <button
              type="button"
              class="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors disabled:opacity-60"
              onClick={props.onGoogleLogin}
              disabled={props.isBusy || !props.googleAvailable}
            >
              <Show when={props.isBusy} fallback={<><GoogleIcon /><span>Continue with Google</span></>}>
                <Spinner color="border-gray-600" /><span>Signing in with Google…</span>
              </Show>
            </button>
          }
        >
          <div class="flex flex-col gap-1">
            <p class="text-sm text-gray-500">{props.googleState}</p>
            <button
              type="button"
              class="self-start text-xs font-medium text-blue-600 hover:underline"
              onClick={props.onClearGoogle}
            >
              Use a different sign-in method
            </button>
          </div>
        </Show>

        <Show when={!props.googleAvailable && !props.googleState}>
          <p class="text-xs text-gray-400">Google sign-in unavailable (Firebase not configured).</p>
        </Show>

        {/* Divider */}
        <div class="flex items-center gap-3 text-xs text-gray-400">
          <div class="flex-1 h-px bg-gray-200" />
          <span>or</span>
          <div class="flex-1 h-px bg-gray-200" />
        </div>

        {/* Username field */}
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-semibold text-gray-700" for="login-identifier">Username</label>
          <input
            id="login-identifier"
            ref={identifierRef!}
            type="text"
            placeholder="Enter your username"
            autocomplete="username"
            disabled={props.isBusy}
            class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors disabled:opacity-50"
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Password field */}
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-semibold text-gray-700" for="login-secret">Password</label>
          <input
            id="login-secret"
            ref={secretRef!}
            type="password"
            placeholder="Enter your password"
            autocomplete="current-password"
            disabled={props.isBusy}
            class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors disabled:opacity-50"
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Submit */}
        <button
          type="button"
          class="w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 active:scale-[0.98] text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          onClick={handleSubmit}
          disabled={props.isBusy}
        >
          <Show when={props.isBusy} fallback="Continue →">
            <Spinner /><span>Signing in…</span>
          </Show>
        </button>
      </div>

      {/* Tab footer */}
      <div class="flex items-center justify-center gap-1.5 py-3 border-t border-gray-100 bg-gray-50 text-sm">
        <span class="text-gray-500">New here?</span>
        <button
          type="button"
          class="font-semibold text-gray-900 underline underline-offset-2 hover:text-blue-600"
          onClick={props.onSwitchToSignup}
        >
          Create account
        </button>
      </div>
    </div>
  );
}
