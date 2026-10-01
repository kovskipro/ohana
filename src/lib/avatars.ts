export const AVATAR_BUCKET = "family-avatars";
export const AVATAR_DIMENSION = 512;
export const AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_OUTPUT_BYTES = 512 * 1024;
export const AVATAR_MAX_SOURCE_DIMENSION = 4096;
export const AVATAR_MAX_SOURCE_PIXELS = 4096 * 4096;

const PROFILE_ID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const AVATAR_FILE_NAME_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.webp";

const profileIdRegex = new RegExp(`^${PROFILE_ID_PATTERN}$`);
const avatarFileNameRegex = new RegExp(`^${AVATAR_FILE_NAME_PATTERN}$`);
const avatarPathRegex = new RegExp(
  `^(${PROFILE_ID_PATTERN})/(${AVATAR_FILE_NAME_PATTERN})$`,
);

export function isProfileId(value: string): boolean {
  return profileIdRegex.test(value);
}

export function isAvatarFileName(value: string): boolean {
  return avatarFileNameRegex.test(value);
}

export function isAvatarPath(
  value: string,
  expectedProfileId?: string,
): boolean {
  const match = avatarPathRegex.exec(value);
  if (!match) return false;
  return expectedProfileId === undefined || match[1] === expectedProfileId;
}

export function avatarPathToUrl(
  path: string | null | undefined,
): string | null {
  return path && isAvatarPath(path) ? `/api/avatars/${path}` : null;
}
