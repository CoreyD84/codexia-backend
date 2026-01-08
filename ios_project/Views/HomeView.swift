import SwiftUI

struct HomeView: View {
    @Binding var path: NavigationPath
    
    var body: some View {
        VStack {
            Button("Profile") {
                path.append(Route.profile)
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    if !path.isEmpty {
                        path.removeLast()
                    }
                }) {
                    Text("Close")
                }
            }
        }
    }
}