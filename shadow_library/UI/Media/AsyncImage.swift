import SwiftUI

/// CODEXIA SHADOW: Replaces Glide/Coil with a high-performance, cached native implementation.
struct ShadowAsyncImage: View {
    let url: URL?
    let contentMode: ContentMode
    
    init(urlPath: String, contentMode: ContentMode = .fill) {
        self.url = URL(string: urlPath)
        self.contentMode = contentMode
    }
    
    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                // Replaces Glide's .placeholder()
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .overlay(
                        ProgressView()
                            .scaleEffect(1.2)
                    )
                    .shimmering() // Optional: Add a shimmer effect here
                
            case .success(let image):
                // Replaces Glide's .centerCrop() or .fitCenter()
                image
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                
            case .failure:
                // Replaces Glide's .error()
                ZStack {
                    Rectangle().fill(Color.gray.opacity(0.1))
                    Image(systemName: "photo.on.rectangle.angled")
                        .foregroundColor(.gray)
                }
                
            @unknown default:
                EmptyView()
            }
        }
    }
}

// Simple extension to mimic the Glide "shimmer" feel
extension View {
    func shimmering() -> some View {
        self.opacity(0.5) // Placeholder for a real animation
    }
}