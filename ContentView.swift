import SwiftUI
import AVFoundation

struct ContentView: View {
    @StateObject private var speechRecognizer = SpeechRecognizer()
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Medora Speech Recognizer")
                .font(.title2)
                .padding(.top)
            
            TextEditor(text: .constant("No transcription available in minimal mode")) // Static text since no speech recognition
                .frame(height: 200)
                .border(Color.gray, width: 1)
                .padding()
            
            ProgressView(value: speechRecognizer.audioLevel, total: 1.0)
                .frame(width: 200)
                .padding(.horizontal)
            Text("Audio Level: \(String(format: "%.2f", speechRecognizer.audioLevel))")
                .foregroundColor(.blue)
            
            if speechRecognizer.audioLevel == 0.0 && speechRecognizer.isListening {
                Text("Warning: No audio detected. Ensure the microphone is unmuted, selected, and no other apps are using it.")
                    .foregroundColor(.red)
                    .padding(.top, 5)
            }
            
            Text("Permission Status: Starting to listen...") // Simplified for minimal mode
                .foregroundColor(.gray)
            
            HStack(spacing: 20) {
                Button(action: {
                    speechRecognizer.startListening()
                }) {
                    Text("Start Listening")
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                .disabled(speechRecognizer.isListening)
                
                Button(action: {
                    speechRecognizer.stopListening()
                }) {
                    Text("Stop Listening")
                        .padding()
                        .background(Color.red)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                .disabled(!speechRecognizer.isListening)
            }
            .padding(.bottom)
        }
    }
}

#Preview {
    ContentView()
}
