import AVFoundation
import CoreImage
import Foundation

guard CommandLine.arguments.count == 3 else {
    fatalError("Usage: swift render-sequence.swift <frames-directory> <output.mp4>")
}

let framesDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let frameURLs = try FileManager.default.contentsOfDirectory(
    at: framesDirectory,
    includingPropertiesForKeys: nil
).filter { $0.lastPathComponent.hasPrefix("frame-") && $0.pathExtension == "jpg" }.sorted {
    $0.lastPathComponent < $1.lastPathComponent
}

guard !frameURLs.isEmpty else { fatalError("No frame JPEGs found") }
try? FileManager.default.removeItem(at: outputURL)

let width = 1280
let height = 800
let fps: Int32 = 30
let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
let input = AVAssetWriterInput(
    mediaType: .video,
    outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
    ]
)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
)
guard writer.canAdd(input) else { fatalError("Cannot add video input") }
writer.add(input)
guard writer.startWriting() else { fatalError(writer.error?.localizedDescription ?? "Cannot start writer") }
writer.startSession(atSourceTime: .zero)

let context = CIContext()
for (index, frameURL) in frameURLs.enumerated() {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
    guard let image = CIImage(contentsOf: frameURL),
          let pool = adaptor.pixelBufferPool else { fatalError("Cannot load \(frameURL.lastPathComponent)") }
    var pixelBuffer: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBuffer) == kCVReturnSuccess,
          let pixelBuffer else { fatalError("Cannot create pixel buffer") }
    context.render(image, to: pixelBuffer, bounds: CGRect(x: 0, y: 0, width: width, height: height), colorSpace: CGColorSpaceCreateDeviceRGB())
    let presentationTime = CMTime(value: CMTimeValue(index), timescale: fps)
    guard adaptor.append(pixelBuffer, withPresentationTime: presentationTime) else {
        fatalError(writer.error?.localizedDescription ?? "Cannot append frame")
    }
}

input.markAsFinished()
await writer.finishWriting()
guard writer.status == .completed else { fatalError(writer.error?.localizedDescription ?? "Writer failed") }
print("Rendered \(frameURLs.count) frames to \(outputURL.path)")
