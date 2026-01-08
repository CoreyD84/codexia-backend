import SwiftUI

struct SettingsView: View {
    @Binding var path: NavigationPath
    
    var body: some View {
        VStack {
            Text("Settings")
                .foregroundColor(Color(hex: "000000"))
            
            Button(action: {
                // Logic for closing or navigating back
                path.removeLast()
            }) {
                Text("Back")
                    .foregroundColor(Color(hex: "000000"))
            }
        }
        .navigationTitle("Settings")
    }
}

struct HomeView: View {
    @Binding var path: NavigationPath
    
    var body: some View {
        VStack {
            Text("Home")
                .foregroundColor(Color(hex: "000000"))
            
            Button(action: {
                // Logic for navigating to settings
                path.append(Route.settings)
            }) {
                Text("Settings")
                    .foregroundColor(Color(hex: "000000"))
            }
        }
        .navigationTitle("Home")
    }
}