import Foundation

protocol NetworkService {
    func request<T: Codable>(url: String, method: String) async throws -> T
}

class NativeNetworkService: NetworkService {
    private let session = URLSession.shared
    
    func request<T: Codable>(url: String, method: String) async throws -> T {
        guard let urlObj = URL(string: url) else { throw URLError(.badURL) }
        
        var request = URLRequest(url: urlObj)
        request.httpMethod = method
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
}
