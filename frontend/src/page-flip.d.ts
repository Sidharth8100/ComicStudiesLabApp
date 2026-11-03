declare module "page-flip" {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>);
    on(event: string, callback: (event: { data: unknown }) => void): void;
    loadFromImages(images: string[]): void;
    destroy(): void;
    getCurrentPageIndex(): number;
    getOrientation(): "portrait" | "landscape";
    turnToPage(page: number): void;
    flip(page: number): void;
  }
}
