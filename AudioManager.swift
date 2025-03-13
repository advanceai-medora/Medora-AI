import Foundation
import AVFoundation
import Dispatch // For DispatchQueue
import Darwin // For usleep

class AudioManager: ObservableObject {
    private let audioEngine = AVAudioEngine()
    @Published var audioLevel: Float = 0.0
    @Published var isListening: Bool = false
    private var audioProcess: Process?

    func startListening() {
        guard !isListening else { return }
        
        let inputNode = audioEngine.inputNode
        let defaultFormat = inputNode.outputFormat(forBus: 0)
        
        print("📡 Audio Engine Description: \(audioEngine)")
        print("📡 Available Inputs: \(AVAudioEngine().inputNode)")
        print("📡 Starting with default format: \(defaultFormat)")
        print("📡 Input node description: \(String(describing: inputNode))")
        print("📡 Input node has inputs: \(inputNode.numberOfInputs > 0)")
        
        let formats: [AVAudioFormat] = [
            AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 44100, channels: 1, interleaved: false)!,
            AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 44100, channels: 1, interleaved: false)!
        ].compactMap { $0 }
        
        let bufferSizes: [AVAudioFrameCount] = [128, 256, 512, 1024, 2048]
        
        testConfigurations(formats, bufferSizes: bufferSizes, currentFormatIndex: 0, currentBufferIndex: 0)
    }

    private func testConfigurations(_ formats: [AVAudioFormat], bufferSizes: [AVAudioFrameCount], currentFormatIndex: Int, currentBufferIndex: Int) {
        guard currentFormatIndex < formats.count else {
            print("❌ No AVAudioEngine configuration worked - falling back to sox")
            startSoxCapture()
            return
        }
        
        let format = formats[currentFormatIndex]
        guard currentBufferIndex < bufferSizes.count else {
            testConfigurations(formats, bufferSizes: bufferSizes, currentFormatIndex: currentFormatIndex + 1, currentBufferIndex: 0)
            return
        }
        
        let bufferSize = bufferSizes[currentBufferIndex]
        print("📡 Testing format: \(format), buffer size: \(bufferSize) frames")
        
        do {
            audioEngine.inputNode.removeTap(onBus: 0)
            audioEngine.inputNode.installTap(onBus: 0, bufferSize: bufferSize, format: format) { buffer, when in
                print("🔊 Audio buffer received (size \(bufferSize), format \(format)): \(buffer.frameLength) frames at time \(when)")
                var maxAmplitude: Float = 0.0
                let frameCount = Int(buffer.frameLength)
                
                if frameCount > 0 && buffer.format.channelCount > 0 {
                    print("📋 Validating buffer data...")
                    if format.commonFormat == .pcmFormatFloat32 {
                        if let channelData = buffer.floatChannelData {
                            for i in 0..<min(frameCount, 100) {
                                let sample = channelData[0][i]
                                print("Sample \(i): \(sample)")
                                if sample.isNaN || sample.isInfinite {
                                    print("❌ Sample \(i) is invalid (NaN or Infinite)")
                                } else if sample == 0.0 {
                                    print("⚠️ Sample \(i) is zero - possible buffer issue")
                                }
                                maxAmplitude = max(maxAmplitude, abs(sample))
                            }
                        } else {
                            print("❌ No float channel data for Float32 format")
                        }
                    } else if format.commonFormat == .pcmFormatInt16 {
                        if let channelData = buffer.int16ChannelData {
                            for i in 0..<min(frameCount, 100) {
                                let sample = Float(channelData[0][i]) / Float(Int16.max)
                                print("Sample \(i): \(sample)")
                                if sample.isNaN || sample.isInfinite {
                                    print("❌ Sample \(i) is invalid (NaN or Infinite)")
                                } else if sample == 0.0 {
                                    print("⚠️ Sample \(i) is zero - possible buffer issue")
                                }
                                maxAmplitude = max(maxAmplitude, abs(sample))
                            }
                        } else {
                            print("❌ No int16 channel data for Int16 format")
                        }
                    }
                }
                
                DispatchQueue.main.async {
                    self.audioLevel = maxAmplitude
                    if maxAmplitude > 0.0 {
                        print("🔉 Audio level: \(maxAmplitude)")
                    } else if currentFormatIndex == formats.count - 1 && currentBufferIndex == bufferSizes.count - 1 {
                        print("⚠️ No audio signal detected after all configurations. Falling back to sox.")
                        self.startSoxCapture()
                    }
                }
            }
            
            audioEngine.prepare()
            try audioEngine.start()
            print("✅ Audio Engine Started Successfully for format \(format) and buffer size \(bufferSize)")
            DispatchQueue.main.async {
                self.isListening = true
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                if self.audioLevel == 0.0 {
                    self.audioEngine.stop()
                    self.audioEngine.inputNode.removeTap(onBus: 0)
                    self.testConfigurations(formats, bufferSizes: bufferSizes, currentFormatIndex: currentFormatIndex, currentBufferIndex: currentBufferIndex + 1)
                }
            }
        } catch {
            print("❌ Failed to install tap or start audio engine for format \(format) and buffer size \(bufferSize): \(error.localizedDescription)")
            testConfigurations(formats, bufferSizes: bufferSizes, currentFormatIndex: currentFormatIndex, currentBufferIndex: currentBufferIndex + 1)
        }
    }

    private func startSoxCapture() {
        let task = Process()
        let soxPath = "/opt/homebrew/Cellar/sox/14.4.2_6/bin/sox" // Ensure this matches your installed version
        print("Debug: Attempting to use sox at \(soxPath)") // Debug print
        guard FileManager.default.fileExists(atPath: soxPath) else {
            print("❌ Sox not found at \(soxPath). Please verify the path and ensure sox is installed.")
            return
        }
        task.executableURL = URL(fileURLWithPath: soxPath)
        task.arguments = ["-t", "coreaudio", "default", "-t", "raw", "-", "rate", "44100", "channels", "1"]
        
        let pipe = Pipe()
        task.standardOutput = pipe
        do {
            try task.run()
            self.audioProcess = task
            let handle = pipe.fileHandleForReading
            self.isListening = true
            print("✅ Sox capture started at path: \(soxPath)")
            
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                guard let self = self else {
                    print("❌ Self is nil, stopping sox capture")
                    task.terminate()
                    return
                }
                while self.isListening {
                    let data = handle.availableData
                    if data.count > 0 {
                        let samples = self.processRawAudio(data)
                        let maxAmplitude = samples.max() ?? 0.0
                        DispatchQueue.main.async {
                            self.audioLevel = maxAmplitude
                            print("🔉 Sox level: \(maxAmplitude) with \(samples.count) samples")
                        }
                    }
                    usleep(10000) // 10ms delay
                }
                task.terminate()
                print("🛑 Sox process terminated")
            }
        } catch {
            print("❌ Failed to run sox process: \(error.localizedDescription)")
        }
    }

    private func processRawAudio(_ data: Data) -> [Float] {
        var samples: [Float] = []
        data.withUnsafeBytes { ptr in
            let buffer = ptr.bindMemory(to: Int16.self)
            for i in 0..<(data.count / MemoryLayout<Int16>.size) {
                let sample = Float(buffer[i]) / Float(Int16.max)
                samples.append(sample)
            }
        }
        return samples
    }

    func stopListening() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        if let process = audioProcess {
            process.terminate()
            self.audioProcess = nil
        }
        isListening = false
        audioLevel = 0.0
        print("🛑 Audio Capture Stopped")
    }
}
