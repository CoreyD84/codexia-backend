import SwiftUI
import Foundation

struct BackendConfig {
    static let BASE_URL = "http://192.168.1.117:3000"
}

enum Route: String {
    case profile
    case settings
}

@main
struct TitanApp: App {
    @State private var path = NavigationPath()
    
    var body: some Scene {
        WindowGroup {
            ContentView(path: $path)
        }
    }
}

struct ContentView: View {
    @Binding var path: NavigationPath
    
    var body: some View {
        NavigationStack(path: $path) {
            VStack {
                Button(action: { path.append(Route.profile) }) {
                    Text("Profile")
                }
                
                Button(action: { path.append(Route.settings) }) {
                    Text("Settings")
                }
            }
        }
    }
}