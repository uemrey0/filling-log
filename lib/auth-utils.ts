export const USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._]{1,28}[a-zA-Z0-9])?$/

export function usernameToManagedEmail(usernameValue: string) {
  return `${usernameValue.toLowerCase()}@plus.nl`
}
