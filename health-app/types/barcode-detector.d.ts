interface BarcodeDetectorOptions {
  formats?: string[]
}

interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox: DOMRectReadOnly
  cornerPoints: ReadonlyArray<{ x: number; y: number }>
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  detect(image: ImageBitmapSource | HTMLVideoElement): Promise<DetectedBarcode[]>
  static getSupportedFormats(): Promise<string[]>
}
