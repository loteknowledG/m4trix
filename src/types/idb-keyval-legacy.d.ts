declare module 'idb-keyval-legacy' {
  export function get<T>(key: string): Promise<T | undefined>;
  export function set(key: string, value: unknown): Promise<void>;
  export function del(key: string): Promise<void>;
  export function keys(): Promise<string[]>;
  export function clear(): Promise<void>;
}
