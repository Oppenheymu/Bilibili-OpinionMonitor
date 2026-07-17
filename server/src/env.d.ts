declare module "qrcode-terminal" {
    export function generate(
        text: string,
        options?: { small?: boolean },
        callback?: (二维码: string) => void,
    ): void;
}
