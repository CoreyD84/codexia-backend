import Foundation

enum Route: String, CaseIterable, Hashable, Identifiable {
    case home
    case profile
    case sprintradio
    
    var id: String { self.rawValue }
}