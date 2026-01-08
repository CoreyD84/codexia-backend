import SwiftUI

enum Route: String {
    case profile
    case settings
}

struct TitanRootView: View {
    @State private var path = NavigationPath()
    
    var body: some Scene {
        WindowGroup {
            ContentView(path: $path)
                .navigationDestination(for: Route.self) { route in
                    switch route {
                        case .profile:
                            ProfileView()
                        case .settings:
                            SettingsView()
                    }
                }
        }
    }
}

struct ContentView: View {
    @Binding var path: NavigationPath
    
    var body: some View {
        VStack {
            Button("Profile") {
                path.append(Route.profile)
            }
            
            Button("Settings") {
                path.append(Route.settings)
            }
        }
    }
}

struct ProfileView: View {
    var body: some View {
        Text("Profile")
    }
}

struct SettingsView: View {
    var body: some View {
        Text("Settings")
    }
}