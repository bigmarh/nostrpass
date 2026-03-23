import { Component, createSignal, Show, onMount } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { useVaultData } from '../hooks/useVaultData';
import { nostrProfileService } from '../services/nostrProfileService';

const ProfileEdit: Component = () => {
  const navigate = useNavigate();
  const params = useParams();
  console.log('[ProfileEdit] Route params:', params);
  const { vaultData, updateVaultData } = useVaultData();
  const { user } = useAuth();

  const [profileFormData, setProfileFormData] = createSignal<{
    name?: string;
    picture?: string;
    about?: string;
    nip05?: string;
    website?: string;
    lud16?: string;
  }>({});

  const [profileError, setProfileError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [fetching, setFetching] = createSignal(false);

  // Find the identity by public key
  const identity = () => {
    const vault = vaultData();
    if (!vault?.identities) return null;
    return vault.identities.find((id: any) => id.publicKey === params.pubkey);
  };

  // Load profile data on mount
  onMount(() => {
    const id = identity();
    if (id?.profile) {
      setProfileFormData(id.profile);
    }
  });

  const handleProfileFieldChange = (field: string, value: string) => {
    setProfileFormData((prev) => ({
      ...prev,
      [field]: value || undefined
    }));
  };

  const getProfileFieldValue = (field: string) => {
    return (profileFormData() as any)[field] || '';
  };

  const handleProfilePictureUpload = async (file: File) => {
    if (file.size > 500 * 1024) {
      setProfileError('Image must be under 500KB');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        handleProfileFieldChange('picture', dataUrl);
      };
      reader.readAsDataURL(file);
      setProfileError(null);
    } catch (err) {
      setProfileError('Failed to upload image');
    }
  };

  const handleRemoveProfilePicture = () => {
    handleProfileFieldChange('picture', '');
  };

  const fetchFromNostr = async () => {
    try {
      setFetching(true);
      setProfileError(null);

      if (!params.pubkey) {
        setProfileError('No public key available');
        return;
      }

      console.log('[ProfileEdit] Fetching Nostr profile for', params.pubkey.slice(0, 8));
      const profile = await nostrProfileService.fetchProfile(params.pubkey);

      if (!profile) {
        setProfileError('No Nostr profile found for this identity');
        return;
      }

      // Update form with fetched data
      setProfileFormData({
        name: profile.name || profile.display_name,
        picture: profile.picture,
        about: profile.about,
        nip05: profile.nip05,
        website: profile.website,
        lud16: profile.lud16
      });

      console.log('[ProfileEdit] Profile fetched successfully');
    } catch (error) {
      console.error('[ProfileEdit] Failed to fetch profile:', error);
      setProfileError('Failed to fetch profile from Nostr');
    } finally {
      setFetching(false);
    }
  };

  const saveProfileChanges = async () => {
    try {
      setSaving(true);
      const currentVault = vaultData();
      if (!currentVault) return;

      const identityIndex = currentVault.identities.findIndex((id: any) => id.publicKey === params.pubkey);
      if (identityIndex === -1) return;

      const formData = profileFormData();
      const updatedIdentities = currentVault.identities.map((id: any, idx: number) => {
        if (idx === identityIndex) {
          return {
            ...id,
            profile: {
              ...(id.profile || {}),
              ...formData
            }
          };
        }
        return id;
      });

      await updateVaultData({
        ...currentVault,
        identities: updatedIdentities
      });

      // Wait briefly for broadcast to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate back to dashboard
      navigate(`/${params.app}/dashboard`);
    } catch (e) {
      setProfileError('Failed to save profile');
      console.error('Failed to save profile:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button
              onClick={() => navigate(`/${params.app}/dashboard`)}
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Profile</h1>
          </div>
          <button
            onClick={fetchFromNostr}
            disabled={fetching()}
            class="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {fetching() ? 'Fetching...' : 'Fetch from Nostr'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Show when={identity()} fallback={
          <div class="text-center py-12">
            <p class="text-gray-500 dark:text-gray-400">Identity not found</p>
          </div>
        }>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div class="space-y-6">
              {/* Profile Picture */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Profile Picture
                </label>
                <div class="flex items-center gap-4">
                  <Show when={getProfileFieldValue('picture')} fallback={
                    <div class="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  }>
                    <img
                      src={getProfileFieldValue('picture')}
                      alt="Profile"
                      class="w-24 h-24 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                    />
                  </Show>
                  <div class="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      id="profile-picture-upload"
                      class="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleProfilePictureUpload(file);
                        }
                      }}
                    />
                    <label
                      for="profile-picture-upload"
                      class="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      Upload Picture
                    </label>
                    <Show when={getProfileFieldValue('picture')}>
                      <button
                        onClick={handleRemoveProfilePicture}
                        class="ml-2 px-4 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        Remove
                      </button>
                    </Show>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Max size: 500KB</p>
                  </div>
                </div>
                <Show when={profileError()}>
                  <p class="mt-2 text-sm text-red-600 dark:text-red-400">{profileError()}</p>
                </Show>
              </div>

              {/* Display Name */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={getProfileFieldValue('name')}
                  onInput={(e) => handleProfileFieldChange('name', e.currentTarget.value)}
                  placeholder="Your display name"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* About */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  About
                </label>
                <textarea
                  value={getProfileFieldValue('about')}
                  onInput={(e) => handleProfileFieldChange('about', e.currentTarget.value)}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* NIP-05 */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  NIP-05 Identifier
                </label>
                <input
                  type="text"
                  value={getProfileFieldValue('nip05')}
                  onInput={(e) => handleProfileFieldChange('nip05', e.currentTarget.value)}
                  placeholder="name@domain.com"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Website */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={getProfileFieldValue('website')}
                  onInput={(e) => handleProfileFieldChange('website', e.currentTarget.value)}
                  placeholder="https://yourwebsite.com"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Lightning Address */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Lightning Address
                </label>
                <input
                  type="text"
                  value={getProfileFieldValue('lud16')}
                  onInput={(e) => handleProfileFieldChange('lud16', e.currentTarget.value)}
                  placeholder="you@getalby.com"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => navigate(`/${params.app}/dashboard`)}
                  class="flex-1 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfileChanges}
                  disabled={saving()}
                  class="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving() ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ProfileEdit;
