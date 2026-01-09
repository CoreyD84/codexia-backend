import SwiftUI

struct ProfileView: View {
    @Binding var path: NavigationPath
    
    var body: some View {
        Text("Profile")
            .navigationBarBackButtonHidden(true)
            .toolbar {
                Button(action: { path.removeLast() }) {
                    Text("Back")
                }
            }
    }
}

@MainActor
class ProfileViewModel: ObservableObject {
    @Published var state = State()
    
    func finish() {
        path.removeLast()
    }
}

struct Wrapper: View {
    @State var path = NavigationPath()
    var body: some View {
        ProfileView(path: $path)
    }
}