/// <reference types="vite/client" />
export {}
declare global {
  interface Window {
    tangtang: { [key: string]: (...args: any[]) => Promise<any> }
  }
}
