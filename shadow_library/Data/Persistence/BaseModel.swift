import Foundation
import SwiftData

// Standard SwiftData Model Shadow
// Replaces: @Entity (Room)
@Model
final class BaseModel {
    // Replaces: @PrimaryKey(autoGenerate = true)
    @Attribute(.unique) var id: UUID = UUID()
    var createdAt: Date = Date()
    
    // Placeholder for AI-injected properties
    // {{PROPERTIES}}
    
    init(id: UUID = UUID(), createdAt: Date = Date()) {
        self.id = id
        self.createdAt = createdAt
    }
}

/* * ARCHITECTURAL NOTE: 
 * Room DAOs are replaced by @Query in SwiftUI Views 
 * or context.insert() in ViewModels.
 */
