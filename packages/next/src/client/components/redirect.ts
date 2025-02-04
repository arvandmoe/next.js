import { requestAsyncStorage } from './request-async-storage.external'
import type { ResponseCookies } from '../../server/web/spec-extension/cookies'

const REDIRECT_ERROR_CODE = 'NEXT_REDIRECT'

export enum RedirectType {
  push = 'push',
  replace = 'replace',
}

export type RedirectError<U extends string> = Error & {
  digest: `${typeof REDIRECT_ERROR_CODE};${RedirectType};${U};${boolean}`
  mutableCookies: ResponseCookies
}

export function getRedirectError(
  url: string,
  type: RedirectType,
  permanent: boolean = false
): RedirectError<typeof url> {
  const error = new Error(REDIRECT_ERROR_CODE) as RedirectError<typeof url>
  error.digest = `${REDIRECT_ERROR_CODE};${type};${url};${permanent}`
  const requestStore = requestAsyncStorage.getStore()
  if (requestStore) {
    error.mutableCookies = requestStore.mutableCookies
  }
  return error
}

/**
 * When used in a streaming context, this will insert a meta tag to
 * redirect the user to the target page. When used in a custom app route, it
 * will serve a 307 to the caller.
 *
 * @param url the url to redirect to
 */
export function redirect(
  url: string,
  type: RedirectType = RedirectType.replace
): never {
  throw getRedirectError(url, type, false)
}

/**
 * When used in a streaming context, this will insert a meta tag to
 * redirect the user to the target page. When used in a custom app route, it
 * will serve a 308 to the caller.
 *
 * @param url the url to redirect to
 */
export function permanentRedirect(
  url: string,
  type: RedirectType = RedirectType.replace
): never {
  throw getRedirectError(url, type, true)
}

/**
 * Checks an error to determine if it's an error generated by the
 * `redirect(url)` helper.
 *
 * @param error the error that may reference a redirect error
 * @returns true if the error is a redirect error
 */
export function isRedirectError<U extends string>(
  error: any
): error is RedirectError<U> {
  if (typeof error?.digest !== 'string') return false

  const [errorCode, type, destination, permanent] = (
    error.digest as string
  ).split(';', 4)

  return (
    errorCode === REDIRECT_ERROR_CODE &&
    (type === 'replace' || type === 'push') &&
    typeof destination === 'string' &&
    (permanent === 'true' || permanent === 'false')
  )
}

/**
 * Returns the encoded URL from the error if it's a RedirectError, null
 * otherwise. Note that this does not validate the URL returned.
 *
 * @param error the error that may be a redirect error
 * @return the url if the error was a redirect error
 */
export function getURLFromRedirectError<U extends string>(
  error: RedirectError<U>
): U
export function getURLFromRedirectError(error: any): string | null {
  if (!isRedirectError(error)) return null

  // Slices off the beginning of the digest that contains the code and the
  // separating ';'.
  return error.digest.split(';', 3)[2]
}

export function getRedirectTypeFromError<U extends string>(
  error: RedirectError<U>
): RedirectType {
  if (!isRedirectError(error)) {
    throw new Error('Not a redirect error')
  }

  return error.digest.split(';', 2)[1] as RedirectType
}

export function getRedirectStatusCodeFromError<U extends string>(
  error: RedirectError<U>
): number {
  if (!isRedirectError(error)) {
    throw new Error('Not a redirect error')
  }

  return error.digest.split(';', 4)[3] === 'true' ? 308 : 307
}
