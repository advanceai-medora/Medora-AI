import SwiftUI

struct ContentView: View {
    @StateObject private var audioManager = AudioManager()

    var body: some View {
        VStack(spacing: 20) {
            Text("Medora Audio Test")
                .font(.largeTitle)
                .fontWeight(.bold)

            // Display audio level
            Text("Audio Level: \(audioManager.audioLevel, specifier: "%.4f")")
                .font(.title2)

            // Visual representation of audio level
            ProgressView(value: min(audioManager.audioLevel, 1.0))
                .progressViewStyle(LinearProgressViewStyle())
                .frame(height: 20)
                .padding(.horizontal)

            // Start/Stop buttons
            HStack(spacing: 20) {
                Button(action: {
                    audioManager.startListening()
                }) {
                    Text("Start Listening")
                        .font(.title3)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(audioManager.isListening ? Color.gray : Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                .disabled(audioManager.isListening)

                Button(action: {
                    audioManager.stopListening()
                }) {
                    Text("Stop Listening")
                        .font(.title3)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(audioManager.isListening ? Color.red : Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                .disabled(!audioManager.isListening)
            }
            .padding(.horizontal)
        }
        .padding()
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
