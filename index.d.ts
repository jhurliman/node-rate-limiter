export type TokenBucketError = string
export type Fail<T> = (error: T) => void
export type Success<T> = (error: null, data: T) => void
export type RemoveTokensCallback = Fail<TokenBucketError> | Success<number>

export declare class TokenBucket {
  constructor(bucketSize: number, tokensPerInterval: number, interval: number, parentBucket?: TokenBucket)

  removeToken(count: number, callback: RemoveTokensCallback): void
  tryRemoveTokens(count: number): boolean
  drip(): boolean
}

export declare class RateLimiter {
  constructor(tokensPerInterval: number, interval: number, fireImmediately?: boolean)

  removeTokens(count: number, callback: RemoveTokensCallback): void
  tryRemoveTokens(count: number): boolean
}
