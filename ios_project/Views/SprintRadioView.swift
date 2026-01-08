import SwiftUI

struct SprintRadioView: View {
    @Binding var path: NavigationPath
    @ObservedObject private var radioManager = RadioManager.getInstance()

    var body: some View {
        VStack {
            Text("Sprint Radio Tower Link")
                .font(.title)
                .padding()
            
            if let signal = radioManager.currentSignal {
                Text("Signal: \(signal.strength)")
                    .foregroundColor(signal.strength == "HIGH" ? Color(hex: "00FF00") : Color(hex: "FF0000"))
            } else {
                ProgressView("Scanning...")
            }
            
            Button("Force Handoff") {
                radioManager.forceLegacyHandoff(protocolType: "GSM")
            }
            .padding()
        }
        .onAppear {
            radioManager.connectToTower("TOWER_AUTO", completion: { _ in })
        }
    }
}