import SwiftUI

struct TitanRootView: View {
    @State private var path = NavigationPath()
    var body: some View {
        NavigationStack(path: $path) {
            HomeView(path: $path) // Default entry point
                .navigationDestination(for: Route.self) { route in
                    switch route {
                        case .home: HomeView(path: $path)
                        case .profile: ProfileView(path: $path)
                        case .sprintradio: SprintRadioView(path: $path)
                    }
                }
        }
    }
}