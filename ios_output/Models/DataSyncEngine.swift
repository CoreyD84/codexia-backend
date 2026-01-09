import SwiftUI

struct HomeView: View {
    @Binding var path: NavigationPath
    
    var body: some View {
        VStack {
            Text("Welcome to the Home Screen")
                .font(.headline)
                .foregroundColor(Color(hex: "34A853"))
            
            Button(action: {
                path.append(Route.profile)
            }) {
                Text("Profile")
                    .padding()
                    .background(Color(hex: "2196F3"))
                    .foregroundColor(Color.white)
                    .cornerRadius(8)
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: {
                    path.removeLast()
                }) {
                    Text("Close")
                        .padding()
                        .background(Color(hex: "E74C3C"))
                        .foregroundColor(Color.white)
                        .cornerRadius(8)
                }
            }
        }
    }
}