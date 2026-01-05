import SwiftUI

struct ShadowRecyclerView<Item: Identifiable, Content: View>: View {
    let items: [Item]
    let emptyTitle: String
    let emptyIcon: String
    let onRefresh: () async -> Void
    @ViewBuilder let rowContent: (Item) -> Content
    
    var body: some View {
        Group {
            if items.isEmpty {
                // Enterprise-grade empty state (iOS 17+)
                if #available(iOS 17.0, *) {
                    ContentUnavailableView(
                        emptyTitle,
                        systemImage: emptyIcon,
                        description: Text("Try pulling down to refresh the list.")
                    )
                } else {
                    VStack(spacing: 10) {
                        Image(systemName: emptyIcon)
                            .font(.largeTitle)
                        Text(emptyTitle)
                            .font(.headline)
                    }
                    .foregroundColor(.secondary)
                }
            } else {
                List(items) { item in
                    rowContent(item)
                }
                .refreshable {
                    await onRefresh()
                }
            }
        }
    }
}
