const titanShadowDefinitions = `
import Foundation

// --- SwiftData & Persistence ---
@attached(member, names: arbitrary) public macro Model() = #externalMacro(module: "None", type: "None")
public struct Attribute { public static func unique() -> Attribute { Attribute() } }

// --- SwiftUI Core ---
public protocol View { var body: Any { get } }
public struct Text: View { public var body: Any; public init(_ t: String) {} }
public struct VStack<Content>: View { public var body: Any; public init(spacing: CGFloat? = nil, @ViewBuilder content: () -> Content) {} }
public struct HStack<Content>: View { public var body: Any; public init(spacing: CGFloat? = nil, @ViewBuilder content: () -> Content) {} }
public struct Image: View { public init(systemName: String) {} }
public struct Button<Content>: View { public init(action: @escaping () -> Void, @ViewBuilder label: () -> Content) {} }

// --- Property Wrappers & State ---
@propertyWrapper public struct State<Value> { public var wrappedValue: Value; public init(wrappedValue: Value) { self.wrappedValue = wrappedValue } }
@propertyWrapper public struct EnvironmentObject<Value> { public var wrappedValue: Value; public init() { } }

// --- Networking & Combine ---
public protocol Codable: Decodable, Encodable {}
public class ObservableObject: NSObject {}
`;

module.exports = { titanShadowDefinitions };
