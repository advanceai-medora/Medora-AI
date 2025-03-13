import Foundation
import AVFoundation

class AudioManager: ObservableObject {
    private let audioEngine = AVAudioEngine()
    @Published var audioLevel: Float = 0.0
    @Published var isListening: Bool = false

    func startListening() {
        guard !isListening else { return }
        
        // Request microphone permission if not already granted
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            if !granted {
                print("❌ Microphone permission denied. Please enable it in System Settings > Security & Privacy > Microphone.")
                return
            }
            
            DispatchQueue.main.async {
                self.setupAudioEngine()
            }
        }
    }

    private func setupAudioEngine() {
        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        
        print("📡 Starting with format: \(format)")
        print("📡 Input node description: \(String(describing: inputNode))")
        print("📡 Input node has inputs: \(inputNode.numberOfInputs > 0)")
        
        do {
            inputNode.installTap(onBus: 0, bufferSize: 2048, format: format) { buffer, when in
                print("🔊 Audio buffer received: \(buffer.frameLength) frames at time \(when)")
                if let channelData = buffer.floatChannelData {
                    var maxAmplitude: Float = 0.0
                    let frameCount = Int(buffer.frameLength)
                    
                    if frameCount > 0 && buffer.format.channelCount > 0 {
                        print("📋 Validating buffer data...")
                        for i in 0..<min(frameCount, 100) { // Log first 100 samples
                            let sample = channelData[0][i]
                            print("Sample \(i): \(sample)")
                            if sample.isNaN || sample.isInfinite {
                                print("❌ Sample \(i) is invalid (NaN or Infinite)")
                            } else if sample == 0.0 {
                                print("⚠️ Sample \(i) is zero - possible issue")
                            }
                            let absoluteSample = abs(sample)
                            maxAmplitude = max(maxAmplitude, absoluteSample)
                        }
                    }
                    
                    DispatchQueue.main.async {
                        self.audioLevel = maxAmplitude
                        print("🔉 Audio level: \(maxAmplitude)")
                        if maxAmplitude == 0.0 {
                            print("⚠️ Warning: No audio signal detected. Check microphone settings, mute status, or close other audio apps.")
                        }
                    }
                } else {
                    print("❌ No channel data in audio buffer. Buffer details: \(buffer)")
                }
            }
            
            audioEngine.prepare()
            try audioEngine.start()
            self.isListening = true
            print("✅ Audio engine started")
        } catch {
            print("❌ Error starting audio engine: \(error.localizedDescription)")
            self.isListening = false
        }
    }

    func stopListening() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
            self.isListening = false
            self.audioLevel = 0.0
            print("🛑 Audio capture stopped")
        }
    }
}