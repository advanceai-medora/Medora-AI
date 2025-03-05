import Foundation
import AVFoundation

class SpeechRecognizer: ObservableObject {
    private let audioEngine = AVAudioEngine()
    @Published var audioLevel: Float = 0.0
    @Published var isListening: Bool = false // Track listening state

    func startListening() {
        guard !isListening else { return } // Prevent multiple starts
        
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0) // Use the hardware’s default format
        
        // Log input device information using AVAudioEngine (limited on macOS)
        print("📡 Current input device: Using system default (check System Settings > Sound > Input)")
        print("📡 Input node format: \(recordingFormat)")
        print("📡 Input node bus count: \(inputNode.numberOfInputs)")
        print("📡 Input node description: \(String(describing: inputNode))")
        
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { (buffer, when) in
            print("🔊 Audio buffer received: \(buffer.frameLength) frames")
            if let channelData = buffer.floatChannelData {
                let pointer = channelData.pointee
                var maxAmplitude: Float = 0.0
                let frameCount = Int(buffer.frameLength)
                
                // Log only the first few samples for brevity
                print("📋 Buffer format: \(String(describing: buffer.format))")
                for i in 0..<min(frameCount, 10) { // Log first 10 samples only
                    let sample = pointer.advanced(by: i).pointee
                    print("Sample \(i): \(sample)")
                    let absoluteSample = abs(sample)
                    maxAmplitude = max(maxAmplitude, absoluteSample)
                }
                let peakLevel = maxAmplitude
                
                print("🔉 Audio level (peak): \(peakLevel)")
                DispatchQueue.main.async {
                    self.audioLevel = peakLevel
                    if peakLevel == 0.0 {
                        print("⚠️ Warning: No audio signal detected. Check microphone settings, mute status, input device, or close other audio apps.")
                    } else if peakLevel < 0.1 {
                        print("⚠️ Warning: Low audio level (\(peakLevel)). Speak louder or adjust microphone volume.")
                    }
                }
            } else {
                print("❌ No channel data in audio buffer")
            }
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
            print("✅ Audio Engine Started Successfully")
            DispatchQueue.main.async {
                self.isListening = true
            }
        } catch {
            print("❌ Failed to start audio engine: \(error)")
        }
    }

    func stopListening() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
            DispatchQueue.main.async {
                self.isListening = false
            }
        }
        audioLevel = 0.0
        print("🛑 Audio Capture Stopped")
    }
}
