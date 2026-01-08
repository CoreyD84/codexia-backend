import SwiftUI

struct MainActivity: View {
    @Binding var path: NavigationPath
    
    var body: some View {
        NavigationStack(path: $path) {
            HomeView()
                .navigationBarBackButtonHidden(true)
        }
    }
}

@MainActor
class BackendConfig {
    static let BASE_URL = "http://192.168.1.117:3000"
}